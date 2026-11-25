/*
 * Code Arsenal sandbox page logic. Runs inside <iframe sandbox="allow-scripts"> (opaque origin).
 * User code NEVER runs on this thread: it runs in a Blob Worker (fresh per JS run, one long-lived Pyodide worker).
 * The parent enforces time limits by destroying the iframe; this page only validates, relays and scores.
 *
 * Protocol (parent -> sandbox): { id, type:'run', lang:'js'|'py', code, spec:{ fn, pyFn, params, tests:[{args, expected, hidden}] } }
 * (sandbox -> parent): { type:'hello' } once loaded, then { id, type:'status', phase, message } | { id, type:'progress', index, total }
 *                      | { id, type:'result', result }
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CASandbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var MAX_CODE = (root.CACore && root.CACore.MAX_CODE_LENGTH) || 50000;
  var MAX_TESTS = 100;
  var MAX_SPEC_JSON = 1000000;
  var IDENT = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
  var ID_RE = /^[a-f0-9]{16,64}$/;
  var RAW_STATUS = ['done', 'compile_error', 'error'];

  function isPlain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function cap(s, n) { s = typeof s === 'string' ? s : ''; return s.length > n ? s.slice(0, n) : s; }

  /** Strictly validate a parent -> sandbox run message. Returns a clean deep copy or null. */
  function validateRun(d) {
    try {
      if (!isPlain(d) || d.type !== 'run' || typeof d.id !== 'string' || !ID_RE.test(d.id)) return null;
      if (d.lang !== 'js' && d.lang !== 'py') return null;
      if (typeof d.code !== 'string' || d.code.length > MAX_CODE) return null;
      var s = d.spec;
      if (!isPlain(s) || typeof s.fn !== 'string' || !IDENT.test(s.fn) || typeof s.pyFn !== 'string' || !IDENT.test(s.pyFn)) return null;
      if (!Array.isArray(s.params) || s.params.length > 12 || !s.params.every(function (p) { return typeof p === 'string' && IDENT.test(p); })) return null;
      if (!Array.isArray(s.tests) || s.tests.length < 1 || s.tests.length > MAX_TESTS) return null;
      var tests = [];
      for (var i = 0; i < s.tests.length; i++) {
        var t = s.tests[i];
        if (!isPlain(t) || !Array.isArray(t.args) || t.args.length > 12) return null;
        tests.push({ args: t.args, expected: t.expected === undefined ? null : t.expected, hidden: t.hidden === true });
      }
      var json = JSON.stringify(tests);
      if (json.length > MAX_SPEC_JSON) return null;
      return { id: d.id, lang: d.lang, code: d.code, spec: { fn: s.fn, pyFn: s.pyFn, params: s.params.slice(), tests: JSON.parse(json) } };
    } catch (e) { return null; }
  }

  /** The spec the worker sees: arguments only. Expected values never enter the worker realm. */
  function workerSpec(spec) {
    return { fn: spec.fn, pyFn: spec.pyFn, params: spec.params, tests: spec.tests.map(function (t) { return { args: t.args }; }) };
  }

  /** Coerce whatever the worker produced into the raw shape scoreResults expects. Returns null if unusable. */
  function sanitizeRaw(raw, testCount) {
    if (!isPlain(raw) || RAW_STATUS.indexOf(raw.status) === -1) return null;
    var out = { status: raw.status, message: cap(raw.message, 600), logs: [], results: [] };
    if (Array.isArray(raw.logs)) raw.logs.slice(0, 200).forEach(function (l) { if (typeof l === 'string') out.logs.push(cap(l, 2000)); });
    if (raw.status === 'done') {
      if (!Array.isArray(raw.results)) return null;
      for (var i = 0; i < testCount; i++) {
        var r = raw.results[i];
        if (!isPlain(r)) { out.results.push({ error: 'No result', ms: 0 }); continue; }
        var ms = typeof r.ms === 'number' && isFinite(r.ms) ? r.ms : 0;
        if (typeof r.error === 'string') out.results.push({ error: cap(r.error, 600), ms: 0 });
        else out.results.push({ actual: r.actual === undefined ? null : r.actual, ms: ms });
      }
    }
    return out;
  }

  function randomNonce() {
    var a = new Uint8Array(16);
    root.crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function init() {
    var judge = root.CAJudge;
    var parentWin = root.parent;
    var busy = false;
    var py = { worker: null, state: 'idle', error: '' }; // idle | loading | ready | failed
    var lastProgress = 0;

    function send(msg) { try { parentWin.postMessage(msg, '*'); } catch (e) { /* parent gone */ } }
    function fail(id, status, message, total) {
      busy = false;
      send({ id: id, type: 'result', result: { status: status, message: message, logs: [], results: [], passedCount: 0, total: total, allPassed: false } });
    }

    function finishRaw(run, rawIn, nonce, data) {
      if (!isPlain(data) || data.type !== 'result' || data.nonce !== nonce) return false; // forged or stale
      var raw = sanitizeRaw(data.raw, run.spec.tests.length);
      busy = false;
      if (!raw) { fail(run.id, 'error', 'The runner returned an unreadable result.', run.spec.tests.length); return true; }
      send({ id: run.id, type: 'result', result: judge.scoreResults(run.spec, raw) });
      return true;
    }

    function handleProgress(run, data) {
      if (!isPlain(data) || data.type !== 'progress' || typeof data.index !== 'number') return;
      var now = Date.now();
      if (now - lastProgress < 50) return; // throttle: user code could flood this channel
      lastProgress = now;
      send({ id: run.id, type: 'progress', index: Math.max(0, Math.min(run.spec.tests.length - 1, Math.floor(data.index) || 0)), total: run.spec.tests.length });
    }

    function runJS(run) {
      var nonce = randomNonce();
      var url = URL.createObjectURL(new Blob([judge.jsWorkerSource()], { type: 'text/javascript' }));
      var w;
      try { w = new Worker(url); } catch (e) { URL.revokeObjectURL(url); fail(run.id, 'error', 'Could not start the JavaScript runner.', run.spec.tests.length); return; }
      URL.revokeObjectURL(url);
      var done = false;
      function end() { done = true; try { w.terminate(); } catch (e) { /* ignore */ } }
      w.onmessage = function (ev) {
        if (done) return;
        var d = ev.data;
        if (isPlain(d) && d.type === 'progress') { handleProgress(run, d); return; }
        if (finishRaw(run, null, nonce, d)) end();
      };
      w.onerror = function (ev) {
        if (done) return;
        if (ev && ev.preventDefault) ev.preventDefault();
        end(); fail(run.id, 'error', 'The runner crashed.', run.spec.tests.length);
      };
      send({ id: run.id, type: 'status', phase: 'running', message: 'Running tests...' });
      w.postMessage({ nonce: nonce, code: run.code, spec: workerSpec(run.spec) });
    }

    function startPy() {
      py.state = 'loading';
      var url = URL.createObjectURL(new Blob([judge.pyWorkerSource()], { type: 'text/javascript' }));
      try { py.worker = new Worker(url); } catch (e) { py.state = 'failed'; py.error = 'Python could not start in this browser.'; URL.revokeObjectURL(url); return; }
      URL.revokeObjectURL(url);
      py.worker.onmessage = function (ev) {
        var d = ev.data;
        if (!isPlain(d)) return;
        if (d.type === 'ready' && py.state === 'loading') { py.state = 'ready'; if (py.onReady) py.onReady(); }
        else if (d.type === 'load_error' && py.state === 'loading') { py.state = 'failed'; py.error = 'Python could not be loaded. Check your connection and try again.'; if (py.onReady) py.onReady(); }
        else if (py.current) {
          if (d.type === 'progress') handleProgress(py.current.run, d);
          else if (finishRaw(py.current.run, null, py.current.nonce, d)) py.current = null;
        }
      };
      py.worker.onerror = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (py.state === 'loading') { py.state = 'failed'; py.error = 'Python could not be loaded. Check your connection and try again.'; if (py.onReady) py.onReady(); }
      };
    }

    function runPy(run) {
      var total = run.spec.tests.length;
      function dispatch() {
        py.onReady = null;
        if (py.state === 'failed') { fail(run.id, 'unavailable', py.error, total); return; }
        var nonce = randomNonce();
        py.current = { run: run, nonce: nonce };
        send({ id: run.id, type: 'status', phase: 'running', message: 'Running tests...' });
        py.worker.postMessage({ nonce: nonce, code: run.code, spec: workerSpec(run.spec) });
      }
      if (py.state === 'idle') startPy();
      if (py.state === 'loading') {
        send({ id: run.id, type: 'status', phase: 'loading', message: 'Loading the Python runtime (first run only)...' });
        py.onReady = dispatch;
      } else dispatch();
    }

    root.addEventListener('message', function (ev) {
      if (ev.source !== parentWin) return;
      var run = validateRun(ev.data);
      if (!run) return;
      if (busy) { send({ id: run.id, type: 'result', result: { status: 'error', message: 'The runner is busy. Try again.', logs: [], results: [], passedCount: 0, total: run.spec.tests.length, allPassed: false } }); return; }
      busy = true;
      if (run.lang === 'js') runJS(run); else runPy(run);
    });

    send({ type: 'hello' });
  }

  if (typeof window !== 'undefined' && root === window && window.parent && window.parent !== window && root.CAJudge) init();

  return { validateRun: validateRun, workerSpec: workerSpec, sanitizeRaw: sanitizeRaw, MAX_TESTS: MAX_TESTS, MAX_SPEC_JSON: MAX_SPEC_JSON };
});
