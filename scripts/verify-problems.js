#!/usr/bin/env node
/* Proves every problem's reference solutions (JS and Python) pass every one of its own tests. */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const judge = require('../js/judge.js');
for (const f of ['algorithms', 'dp-ml', 'applied']) require(path.join('..', 'js', 'problems', f + '.js'));
const reg = globalThis.CA_PROBLEMS_REG;
let bad = 0;
const fail = (id, msg) => { bad++; console.log('FAIL', id, msg); };
const ids = new Set();
const cats = {};
for (const p of reg) {
  if (ids.has(p.id)) fail(p.id, 'duplicate id');
  ids.add(p.id);
  cats[p.category] = (cats[p.category] || 0) + 1;
  if (!/^[a-z0-9-]+$/.test(p.id)) fail(p.id, 'bad id');
  if (p.hints.length !== 3) fail(p.id, 'needs 3 hints');
  if (p.tests.length < 4) fail(p.id, 'needs >=4 tests');
  if (!p.tests.some((t) => t.hidden)) fail(p.id, 'needs a hidden test');
  if (!p.tests.some((t) => !t.hidden)) fail(p.id, 'needs a visible test');
  const spec = { fn: p.fn, pyFn: judge.toSnake(p.fn), params: p.params, tests: p.tests };
  // JavaScript
  const js = judge.scoreResults(spec, judge.judgeJS(p.solutions.js, spec));
  if (!js.allPassed) fail(p.id, 'JS ' + JSON.stringify(js.results.filter((r) => !r.passed).slice(0, 2)) + ' ' + js.message);
  // Python
  const driver = judge.PY_HARNESS + '\nimport sys, json\nd = json.load(sys.stdin)\nprint(__ca_run(d["code"], d["fn"], json.dumps(d["tests"])))';
  const r = spawnSync('python3', ['-I', '-c', driver], { input: JSON.stringify({ code: p.solutions.py, fn: spec.pyFn, tests: p.tests.map((t) => ({ args: t.args })) }), encoding: 'utf8' });
  if (r.status !== 0) { fail(p.id, 'python crashed: ' + r.stderr.slice(0, 300)); continue; }
  const py = judge.scoreResults(spec, JSON.parse(r.stdout));
  if (!py.allPassed) fail(p.id, 'PY ' + JSON.stringify(py.results.filter((x) => !x.passed).slice(0, 2)) + ' ' + py.message);
}
console.log(reg.length + ' problems', JSON.stringify(cats));
console.log(bad ? bad + ' FAILURES' : 'ALL REFERENCE SOLUTIONS PASS (JS + Python)');
process.exit(bad ? 1 : 0);
