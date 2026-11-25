const test = require('node:test');
const assert = require('node:assert/strict');
const { judge } = require('./load.js');

const spec = (tests) => ({ fn: 'f', pyFn: 'f', params: ['x'], tests });
const run = (code, tests) => judge.scoreResults(spec(tests), judge.judgeJS(code, spec(tests)));

test('deepEqual: ints exact, floats tolerant, shapes strict', () => {
  const d = judge.deepEqual;
  assert.ok(d(1, 1)); assert.ok(!d(1836311903, 1836311904)); assert.ok(d(0.3, 0.1 + 0.2));
  assert.ok(!d(1, '1')); assert.ok(!d([1], { 0: 1 })); assert.ok(!d({ a: 1 }, { a: 1, b: 2 })); assert.ok(!d({ a: 1, b: 2 }, { a: 1 }));
  assert.ok(d(null, null)); assert.ok(!d(null, 0)); assert.ok(!d(NaN, NaN)); assert.ok(d([[1, { a: [2] }]], [[1, { a: [2] }]]));
  assert.ok(!d({ a: undefined }, { b: undefined }));
});

test('correct, wrong and throwing solutions are told apart', () => {
  const tests = [{ args: [2], expected: 4 }, { args: [3], expected: 9, hidden: true }];
  assert.ok(run('function f(x){return x*x}', tests).allPassed);
  const wrong = run('function f(x){return x+x}', tests);
  assert.equal(wrong.passedCount, 1); assert.equal(wrong.allPassed, false);
  const boom = run('function f(x){ throw new TypeError("bad") }', tests);
  assert.match(boom.results[0].error, /TypeError: bad/);
  assert.equal(boom.results[1].error, 'The solution raised an error on this hidden test.');
});

test('hidden tests never leak their data', () => {
  const r = run('function f(x){return 1}', [{ args: [123456], expected: 987654, hidden: true }]);
  const text = JSON.stringify(r);
  assert.ok(!text.includes('123456') && !text.includes('987654'));
});

test('compile errors, missing function and bad results are reported', () => {
  assert.equal(run('function f(', [{ args: [1], expected: 1 }]).status, 'compile_error');
  const missing = run('function g(){}', [{ args: [1], expected: 1 }]);
  assert.equal(missing.status, 'error'); assert.match(missing.message, /Define a function named f/);
  assert.match(run('function f(){return Infinity}', [{ args: [1], expected: 1 }]).results[0].error, /finite/);
  assert.match(run('async function f(){return 1}', [{ args: [1], expected: 1 }]).results[0].error, /Async/);
  assert.equal(run('function f(){}', [{ args: [1], expected: null }]).allPassed, true);
});

test('arguments are cloned per test so mutation cannot leak', () => {
  const tests = [{ args: [[1, 2]], expected: 2 }, { args: [[1, 2]], expected: 2 }];
  assert.ok(run('function f(a){ a.pop(); return a.length+1 }', tests).allPassed);
});

test('console output is captured and capped', () => {
  const r = run('function f(x){ for(let i=0;i<500;i++) console.log("line", i); return x }', [{ args: [1], expected: 1 }]);
  assert.equal(r.logs.length, 200); assert.equal(r.logs[0], 'line 0');
});

test('snake_case names', () => {
  assert.equal(judge.toSnake('runLRUCache'), 'run_lru_cache');
  assert.equal(judge.toSnake('twoSum'), 'two_sum');
  assert.equal(judge.toSnake('djb2'), 'djb2');
});

test('worker sources are self-contained and syntactically valid', () => {
  new Function(judge.jsWorkerSource());
  new Function(judge.pyWorkerSource());
});
