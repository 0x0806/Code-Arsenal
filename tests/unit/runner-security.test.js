const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.CAJudge = require('../../js/judge.js');
globalThis.CACore = require('../../js/core.js');
const sandbox = require('../../js/sandbox.js');
const runner = require('../../js/runner.js');
const { problems } = require('./load.js');

const ID = 'a'.repeat(32);
const good = () => ({ id: ID, type: 'run', lang: 'js', code: 'function f(){}', spec: { fn: 'f', pyFn: 'f', params: ['a'], tests: [{ args: [1], expected: 2, hidden: false }] } });

test('validateRun accepts a well formed message and returns a clean copy', () => {
  const m = sandbox.validateRun(good());
  assert.equal(m.id, ID);
  assert.deepEqual(m.spec.tests, [{ args: [1], expected: 2, hidden: false }]);
});

test('validateRun rejects malformed messages', () => {
  const bad = [null, 'x', [], {}, { ...good(), type: 'result' }, { ...good(), id: 'zz' }, { ...good(), lang: 'rb' }, { ...good(), code: 5 },
    { ...good(), code: 'x'.repeat(CACore.MAX_CODE_LENGTH + 1) }];
  for (const b of bad) assert.equal(sandbox.validateRun(b), null);
  const s = (patch) => { const g = good(); Object.assign(g.spec, patch); return g; };
  assert.equal(sandbox.validateRun(s({ fn: 'a;alert(1)' })), null, 'fn is concatenated into code, so must be an identifier');
  assert.equal(sandbox.validateRun(s({ params: ['ok', 'b c'] })), null);
  assert.equal(sandbox.validateRun(s({ tests: [] })), null);
  assert.equal(sandbox.validateRun(s({ tests: [{ args: 'no' }] })), null);
  assert.equal(sandbox.validateRun(s({ tests: Array(sandbox.MAX_TESTS + 1).fill({ args: [] }) })), null);
  assert.equal(sandbox.validateRun(s({ tests: [{ args: ['x'.repeat(sandbox.MAX_SPEC_JSON)], expected: 1 }] })), null);
});

test('accepts the code length limit exactly', () => {
  const g = good(); g.code = 'x'.repeat(CACore.MAX_CODE_LENGTH);
  assert.ok(sandbox.validateRun(g));
});

test('workerSpec never carries expected values', () => {
  const w = sandbox.workerSpec(sandbox.validateRun(good()).spec);
  assert.deepEqual(w.tests, [{ args: [1] }]);
  assert.ok(!JSON.stringify(w).includes('expected'));
});

test('sanitizeRaw coerces and rejects worker output', () => {
  assert.equal(sandbox.sanitizeRaw({ status: 'passed' }, 1), null);
  assert.equal(sandbox.sanitizeRaw({ status: 'done' }, 1), null);
  const r = sandbox.sanitizeRaw({ status: 'done', results: [{ actual: 3, ms: 1 }, 'junk'], logs: ['a', 5] }, 3);
  assert.equal(r.results.length, 3);
  assert.equal(r.results[1].error, 'No result');
  assert.deepEqual(r.logs, ['a']);
});

test('worker sources: nonce-gated result, no expected scoring in worker, no leaked globals', () => {
  for (const src of [CAJudge.jsWorkerSource(), CAJudge.pyWorkerSource()]) {
    assert.match(src, /nonce: nonce/);
    assert.ok(!/scoreResults/.test(src));
    assert.ok(src.startsWith('(function () {'));
  }
});

test('runner buildSpec: run mode omits hidden tests, submit keeps all', () => {
  const p = problems[0];
  const hidden = p.tests.filter((t) => t.hidden).length;
  assert.ok(hidden > 0);
  assert.equal(runner._test.buildSpec(p, 'run').tests.length, p.tests.length - hidden);
  assert.equal(runner._test.buildSpec(p, 'submit').tests.length, p.tests.length);
  assert.ok(runner._test.buildSpec(p, 'run').tests.every((t) => !t.hidden));
});

test('runner parseSandboxMessage enforces id and shape', () => {
  const ok = { id: ID, type: 'result', result: { status: 'done', message: '', logs: [], results: [], passedCount: 1, total: 1, allPassed: true } };
  assert.ok(runner._test.parseSandboxMessage(ok, ID));
  assert.equal(runner._test.parseSandboxMessage(ok, 'b'.repeat(32)), null, 'wrong run id');
  assert.equal(runner._test.parseSandboxMessage({ ...ok, id: 'nope' }, 'nope'), null);
  assert.equal(runner._test.parseSandboxMessage({ ...ok, result: { ...ok.result, status: 'hacked' } }, ID), null);
  assert.equal(runner._test.parseSandboxMessage({ id: ID, type: 'weird' }, ID), null);
  assert.equal(runner._test.parseSandboxMessage('str', ID), null);
  assert.deepEqual(runner._test.parseSandboxMessage({ type: 'hello' }, ID), { type: 'hello' });
});

test('runner sanitizeResult hides hidden-test details and caps strings', () => {
  const r = runner._test.sanitizeResult({ status: 'done', message: 'x'.repeat(5000), passedCount: 0, total: 1, allPassed: false, logs: [],
    results: [{ index: 0, hidden: true, passed: false, ms: 1, expected: 'secret', actual: 'secret2' }] });
  assert.equal(r.message.length, 600);
  assert.ok(!('expected' in r.results[0]) && !('actual' in r.results[0]));
});

test('run() resolves (never rejects) on invalid input', async () => {
  const r = await runner.run({ lang: 'js', code: 'x'.repeat(CACore.MAX_CODE_LENGTH + 1), problem: problems[0], mode: 'run' });
  assert.equal(r.status, 'error');
  const r2 = await runner.run({ lang: 'rb', code: 'x', problem: problems[0], mode: 'run' });
  assert.equal(r2.status, 'error');
});
