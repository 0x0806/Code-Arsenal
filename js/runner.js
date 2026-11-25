/*
 * CARunner: runs user code inside the sandboxed iframe (sandbox.html) and enforces time limits from the parent.
 * Only messages whose event.source is the iframe's window AND whose id matches the in-flight run are honoured.
 * A timeout destroys the iframe (and with it every worker), so even a wedged worker cannot outlive the limit.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CARunner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var JS_TIMEOUT_MS = 4000;
  var PY_LOAD_TIMEOUT_MS = 90000;
  var PY_RUN_TIMEOUT_MS = 8000;
  var FRAME_TIMEOUT_MS = 10000;
  var MAX_CODE = (root.CACore && root.CACore.MAX_CODE_LENGTH) || 50000;
  var STATUSES = ['done', 'compile_error', 'error', 'timeout', 'unavailable'];
  var ID_RE = /^[a-f0-9]{16,64}$/;

  function isPlain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function cap(s, n) { s = typeof s === 'string' ? s : ''; return s.length > n ? s.slice(0, n) : s; }

  function randomId() {
    var a = new Uint8Array(16);
    root.crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  /** Build the spec sent to the sandbox. mode 'run' omits hidden tests. */
  function buildSpec(problem, mode) {
    var tests = problem.tests.filter(function (t) { return mode === 'submit' || t.hidden !== true; });
    return {
      fn: problem.fn, pyFn: problem.pyFn, params: problem.params,
      tests: tests.map(function (t) { return { args: t.args, expected: t.expected, hidden: t.hidden === true }; })
    };
  }

  function emptyResult(status, message, total) {
    return { status: status, message: message, logs: [], results: [], passedCount: 0, total: total, allPassed: false };
  }

  /** Accept a sandbox message only if its shape is valid. Returns a normalised message or null. */
  function parseSandboxMessage(d, expectedId) {
    if (!isPlain(d) || typeof d.type !== 'string') return null;
    if (d.type === 'hello') return { type: 'hello' };
    if (typeof d.id !== 'string' || !ID_RE.test(d.id) || d.id !== expectedId) return null;
    if (d.type === 'status') return { type: 'status', phase: d.phase === 'loading' ? 'loading' : 'running', message: cap(d.message, 200) };
    if (d.type === 'progress') return typeof d.index === 'number' && typeof d.total === 'number' ? { type: 'progress', index: Math.floor(d.index), total: Math.floor(d.total) } : null;
    if (d.type === 'result') {
      var r = sanitizeResult(d.result);
      return r ? { type: 'result', result: r } : null;
    }
    return null;
  }

  /** Copy a result into a known-safe shape (the UI will render these fields). */
  function sanitizeResult(r) {
    if (!isPlain(r) || STATUSES.indexOf(r.status) === -1 || !Array.isArray(r.results) || r.results.length > 200) return null;
    var out = {
      status: r.status, message: cap(r.message, 600), logs: [], results: [],
      passedCount: Math.max(0, Math.floor(Number(r.passedCount) || 0)), total: Math.max(0, Math.floor(Number(r.total) || 0)), allPassed: r.allPassed === true
    };
    if (Array.isArray(r.logs)) r.logs.slice(0, 200).forEach(function (l) { if (typeof l === 'string') out.logs.push(cap(l, 2000)); });
    r.results.forEach(function (it) {
      if (!isPlain(it)) return;
      var o = { index: Math.floor(Number(it.index) || 0), hidden: it.hidden === true, passed: it.passed === true, ms: Number(it.ms) || 0 };
      if (!o.hidden) {
        if ('input' in it) o.input = it.input;
        if ('expected' in it) o.expected = it.expected;
        if ('actual' in it) o.actual = it.actual;
        if (typeof it.error === 'string') o.error = cap(it.error, 600);
      } else if (typeof it.error === 'string') o.error = cap(it.error, 600);
      out.results.push(o);
    });
    return out;
  }

  /* ------------------------------------ browser side ------------------------------------ */
  var frame = null;
  var helloSeen = false;
  var pending = null; // { id, accept(msg) }
  var chain = Promise.resolve();
  var listening = false;

  function onMessage(ev) {
    if (!frame || ev.source !== frame.contentWindow) return;
    var d = ev.data;
    if (isPlain(d) && d.type === 'hello') {
      helloSeen = true;
      if (pending && pending.onHello) pending.onHello();
      return;
    }
    if (!pending) return;
    var msg = parseSandboxMessage(d, pending.id);
    if (msg) pending.accept(msg);
  }

  function ensureFrame() {
    if (frame) return;
    if (!listening) { root.addEventListener('message', onMessage); listening = true; }
    helloSeen = false;
    frame = root.document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('title', 'Code execution sandbox');
    frame.setAttribute('aria-hidden', 'true');
    frame.hidden = true;
    frame.src = 'sandbox.html';
    root.document.body.appendChild(frame);
  }

  function killFrame() {
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    frame = null; helloSeen = false;
  }

  function doRun(opts) {
    return new Promise(function (resolve) {
      var problem = opts && opts.problem;
      var lang = opts && opts.lang;
      var spec;
      try { spec = buildSpec(problem, opts.mode === 'submit' ? 'submit' : 'run'); } catch (e) { resolve(emptyResult('error', 'Invalid problem.', 0)); return; }
      var total = spec.tests.length;
      if (lang !== 'js' && lang !== 'py') { resolve(emptyResult('error', 'Unknown language.', total)); return; }
      var code = opts.code;
      if (typeof code !== 'string' || code.trim() === '') { resolve(emptyResult('error', 'Write some code first.', total)); return; }
      if (code.length > MAX_CODE) { resolve(emptyResult('error', 'Code is too long (limit ' + MAX_CODE + ' characters).', total)); return; }
      var onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : function () {};
      function status(m) { try { onStatus(m); } catch (e) { /* UI callback errors must not break the run */ } }

      ensureFrame();
      var id = randomId();
      var timer = null, settled = false, phase = 'waiting';

      function finish(result, kill) {
        if (settled) return;
        settled = true; clearTimeout(timer); pending = null;
        if (kill) killFrame();
        resolve(result);
      }
      function arm(ms, fn) { clearTimeout(timer); timer = setTimeout(fn, ms); }
      function onTimeout() {
        if (lang === 'py' && phase === 'loading') {
          finish(emptyResult('unavailable', 'Python could not be loaded in time. Check your connection and try again, or use JavaScript.', total), true);
        } else {
          var secs = (lang === 'js' ? JS_TIMEOUT_MS : PY_RUN_TIMEOUT_MS) / 1000;
          finish(emptyResult('timeout', 'Time limit exceeded (' + secs + 's). Check for an infinite loop or a very slow algorithm.', total), true);
        }
      }
      function post() {
        phase = lang === 'js' ? 'running' : 'loading';
        arm(lang === 'js' ? JS_TIMEOUT_MS : PY_LOAD_TIMEOUT_MS, onTimeout);
        frame.contentWindow.postMessage({ id: id, type: 'run', lang: lang, code: code, spec: spec }, '*');
      }

      pending = {
        id: id,
        onHello: post,
        accept: function (msg) {
          if (msg.type === 'status') {
            if (msg.phase === 'running' && lang === 'py' && phase !== 'running') { phase = 'running'; arm(PY_RUN_TIMEOUT_MS, onTimeout); }
            if (msg.message) status(msg.message);
          } else if (msg.type === 'progress') {
            status('Running test ' + Math.min(msg.total, msg.index + 1) + ' of ' + msg.total + '...');
          } else if (msg.type === 'result') {
            finish(msg.result, msg.result.status === 'unavailable');
          }
        }
      };
      if (helloSeen) post();
      else arm(FRAME_TIMEOUT_MS, function () { finish(emptyResult('unavailable', 'The code runner could not start.', total), true); });
    });
  }

  /** Run code against a problem's tests. Never rejects. */
  function run(opts) {
    var p = chain.then(function () { return doRun(opts); }).catch(function () {
      killFrame();
      return emptyResult('error', 'The code runner failed unexpectedly.', 0);
    });
    chain = p;
    return p;
  }

  /** Remove the sandbox (stops any running code). A later run recreates it. */
  function dispose() {
    var p = pending;
    killFrame();
    if (p && p.accept) p.accept({ type: 'result', result: emptyResult('error', 'Run cancelled.', 0) });
  }

  return {
    run: run, dispose: dispose,
    JS_TIMEOUT_MS: JS_TIMEOUT_MS, PY_LOAD_TIMEOUT_MS: PY_LOAD_TIMEOUT_MS, PY_RUN_TIMEOUT_MS: PY_RUN_TIMEOUT_MS,
    _test: { buildSpec: buildSpec, parseSandboxMessage: parseSandboxMessage, sanitizeResult: sanitizeResult, emptyResult: emptyResult }
  };
});
