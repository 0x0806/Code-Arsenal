/*
 * Code Arsenal judge: comparison and harness logic shared by the browser workers and Node tests.
 * Every function below that is serialised into a worker (deepEqual, normalize, scoreResults,
 * judgeJS) must stay self-contained: no references to anything outside its own body.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CAJudge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Compare an actual value with the expected one. Integers must match exactly; floats within 1e-6. */
  function deepEqual(actual, expected) {
    if (actual === expected) return true;
    if (typeof expected === 'number' && typeof actual === 'number') {
      if (Number.isNaN(expected) || Number.isNaN(actual)) return false;
      if (Number.isInteger(expected)) return actual === expected;
      return Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(expected));
    }
    if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') return false;
    if (Array.isArray(expected) !== Array.isArray(actual)) return false;
    if (Array.isArray(expected)) {
      if (expected.length !== actual.length) return false;
      for (var i = 0; i < expected.length; i++) if (!deepEqual(actual[i], expected[i])) return false;
      return true;
    }
    var ek = Object.keys(expected), ak = Object.keys(actual);
    if (ek.length !== ak.length) return false;
    for (var j = 0; j < ek.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(actual, ek[j])) return false;
      if (!deepEqual(actual[ek[j]], expected[ek[j]])) return false;
    }
    return true;
  }

  /** Make a return value comparable: JSON round trip, undefined becomes null. */
  function normalize(value) {
    if (value === undefined) return null;
    if (value && typeof value.then === 'function') throw new Error('Async results are not supported. Return a plain value.');
    if (typeof value === 'number' && !isFinite(value)) throw new Error('Result is ' + value + '. Return a finite number.');
    return JSON.parse(JSON.stringify(value));
  }

  /** Run a JavaScript solution against tests. Returns raw per-test outcomes (no scoring). */
  function judgeJS(code, spec, hooks) {
    var logs = [];
    var capture = function () {
      var line = Array.prototype.map.call(arguments, function (a) {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(' ');
      if (logs.length < 200) logs.push(line.length > 2000 ? line.slice(0, 2000) + '…' : line);
    };
    var sandboxConsole = { log: capture, info: capture, warn: capture, error: capture, debug: capture };
    var fn;
    try {
      var factory = new Function('console', code + '\n;return (typeof ' + spec.fn + ' === "function") ? ' + spec.fn + ' : undefined;');
      fn = factory(sandboxConsole);
    } catch (e) {
      return { status: 'compile_error', message: (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : String(e)), logs: logs, results: [] };
    }
    if (typeof fn !== 'function') {
      return { status: 'error', message: 'Define a function named ' + spec.fn + '(' + spec.params.join(', ') + ').', logs: logs, results: [] };
    }
    var results = [];
    for (var i = 0; i < spec.tests.length; i++) {
      if (hooks && hooks.onTest) hooks.onTest(i);
      var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      try {
        var args = JSON.parse(JSON.stringify(spec.tests[i].args));
        var out = normalize(fn.apply(null, args));
        results.push({ actual: out, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 });
      } catch (e) {
        results.push({ error: (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : String(e)), ms: 0 });
      }
    }
    return { status: 'done', logs: logs, results: results };
  }

  /** Combine raw outcomes with the expected values into a UI-safe verdict. Hidden tests reveal nothing. */
  function scoreResults(spec, raw) {
    var out = { status: raw.status, message: raw.message || '', logs: raw.logs || [], results: [], passedCount: 0, total: spec.tests.length, allPassed: false };
    if (raw.status !== 'done') return out;
    for (var i = 0; i < spec.tests.length; i++) {
      var t = spec.tests[i], r = raw.results[i] || { error: 'No result' };
      var passed = !r.error && deepEqual(r.actual, t.expected);
      var item = { index: i, hidden: !!t.hidden, passed: passed, ms: Math.round((r.ms || 0) * 100) / 100 };
      if (!t.hidden) {
        item.input = t.args;
        item.expected = t.expected;
        if (r.error) item.error = r.error; else item.actual = r.actual;
      } else if (r.error) {
        item.error = 'The solution raised an error on this hidden test.';
      }
      if (passed) out.passedCount++;
      out.results.push(item);
    }
    out.allPassed = out.passedCount === out.total && out.total > 0;
    return out;
  }

  /** Convert camelCase to snake_case for the Python function names. */
  function toSnake(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase();
  }

  /** Python harness. Receives code, function name and the tests as JSON; returns raw outcomes as JSON. */
  var PY_HARNESS = [
    'import json, sys, io, time, copy',
    'def __ca_run(code, fn, tests_json):',
    '    out = io.StringIO()',
    '    old = sys.stdout',
    '    sys.stdout = out',
    '    try:',
    '        ns = {"__name__": "__ca__"}',
    '        try:',
    '            exec(compile(code, "solution.py", "exec"), ns)',
    '        except SyntaxError as e:',
    '            return json.dumps({"status": "compile_error", "message": "SyntaxError: %s (line %s)" % (e.msg, e.lineno), "logs": []})',
    '        except BaseException as e:',
    '            return json.dumps({"status": "error", "message": "%s: %s" % (type(e).__name__, e), "logs": out.getvalue().splitlines()[:200]})',
    '        f = ns.get(fn)',
    '        if not callable(f):',
    '            return json.dumps({"status": "error", "message": "Define a function named %s." % fn, "logs": []})',
    '        results = []',
    '        for t in json.loads(tests_json):',
    '            t0 = time.perf_counter()',
    '            try:',
    '                r = f(*copy.deepcopy(t["args"]))',
    '                actual = json.loads(json.dumps(r, allow_nan=False))',
    '                results.append({"actual": actual, "ms": (time.perf_counter() - t0) * 1000})',
    '            except BaseException as e:',
    '                results.append({"error": "%s: %s" % (type(e).__name__, e), "ms": 0})',
    '        return json.dumps({"status": "done", "results": results, "logs": [l[:2000] for l in out.getvalue().splitlines()[:200]]})',
    '    finally:',
    '        sys.stdout = old'
  ].join('\n');

  var PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

  /* Worker side hardening: no network or nested workers, and the replacements cannot be deleted or reassigned. */
  function lockdown() {
    ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'SharedWorker', 'WebTransport'].forEach(function (k) {
      for (var o = self; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
        try { if (Object.prototype.hasOwnProperty.call(o, k)) Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch (e) { /* ignore */ }
      }
    });
  }

  /*
   * Result integrity. Workers never see `expected` values (the sandbox strips them) and never score.
   * Each run message carries a one-time `nonce` that is held only in a closure local to the bootstrap, which also
   * captured postMessage before any user code ran. A "result" without the matching nonce is ignored by the sandbox,
   * so user code calling self.postMessage({type:"result"}) cannot forge a verdict. The whole bootstrap lives in an IIFE
   * so helper functions are not reachable as worker globals.
   */

  /** Source of the JavaScript judging worker. */
  function jsWorkerSource() {
    return [
      '(function () {',
      '"use strict";',
      'var normalize = ' + normalize.toString() + ';',
      'var judgeJS = ' + judgeJS.toString() + ';',
      'var lockdown = ' + lockdown.toString() + ';',
      'var post = self.postMessage.bind(self);',
      'self.onmessage = function (e) {',
      '  var d = e.data;',
      '  var nonce = d.nonce;',
      '  self.onmessage = null;',
      '  lockdown();',
      '  var raw = judgeJS(d.code, d.spec, { onTest: function (i) { post({ type: "progress", index: i }); } });',
      '  post({ type: "result", nonce: nonce, raw: raw });',
      '};',
      '})();'
    ].join('\n');
  }

  /** Source of the Pyodide worker. Loads the runtime once and then serves many runs (each with its own nonce). */
  function pyWorkerSource() {
    return [
      '(function () {',
      '"use strict";',
      'var lockdown = ' + lockdown.toString() + ';',
      'var HARNESS = ' + JSON.stringify(PY_HARNESS) + ';',
      'var post = self.postMessage.bind(self);',
      'var pyodide = null;',
      'var ready = (async function () {',
      '  importScripts(' + JSON.stringify(PYODIDE_URL + 'pyodide.js') + ');',
      '  pyodide = await loadPyodide({ indexURL: ' + JSON.stringify(PYODIDE_URL) + ' });',
      '  pyodide.runPython(HARNESS);',
      '  lockdown();',
      '  post({ type: "ready" });',
      '})().catch(function (e) { post({ type: "load_error", message: String(e && e.message || e) }); });',
      'self.onmessage = async function (e) {',
      '  var d = e.data;',
      '  var nonce = d.nonce;',
      '  await ready;',
      '  if (!pyodide) return;',
      '  var raw;',
      '  try {',
      '    var run = pyodide.globals.get("__ca_run");',
      '    var json = run(d.code, d.spec.pyFn, JSON.stringify(d.spec.tests.map(function (t) { return { args: t.args }; })));',
      '    run.destroy();',
      '    raw = JSON.parse(json);',
      '  } catch (err) {',
      '    raw = { status: "error", message: String(err && err.message || err), logs: [] };',
      '  }',
      '  post({ type: "result", nonce: nonce, raw: raw });',
      '};',
      '})();'
    ].join('\n');
  }

  return {
    deepEqual: deepEqual,
    normalize: normalize,
    judgeJS: judgeJS,
    scoreResults: scoreResults,
    toSnake: toSnake,
    PY_HARNESS: PY_HARNESS,
    PYODIDE_URL: PYODIDE_URL,
    jsWorkerSource: jsWorkerSource,
    pyWorkerSource: pyWorkerSource
  };
});
