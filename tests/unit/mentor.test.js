const test = require('node:test');
const assert = require('node:assert/strict');
const { core, problems } = require('./load.js');
const CAMentor = require('../../js/mentor.js');

const stats = () => core.stats(core.createState(), problems);
const base = (extra) => Object.assign({ stats: stats(), problems }, extra);
const twoSum = problems.find((p) => p.id === 'two-sum');

// Every non-trivial code line of every reference solution
const solutionLines = [];
problems.forEach((p) => Object.values(p.solutions).forEach((src) => src.split('\n').forEach((l) => { const t = l.trim(); if (t.length >= 12) solutionLines.push(t); })));

test('hints escalate per request using caller state and never leak solutions', () => {
  const state = {};
  const texts = [];
  for (let i = 0; i < twoSum.hints.length + 2; i++) texts.push(CAMentor.reply('I am stuck, hint please', base({ problem: twoSum }), state).text);
  assert.ok(texts[0].includes(twoSum.hints[0]));
  assert.ok(texts[1].includes(twoSum.hints[1]));
  assert.ok(texts[2].includes(twoSum.hints[2]));
  assert.ok(texts[4].includes(twoSum.hints[2]), 'stays on the last hint');
  assert.ok(texts[2].includes('last hint'));
});

test('no reference-solution line appears in replies to hint or solution requests before solve', () => {
  for (const p of problems) {
    const state = {};
    const replies = [];
    for (let i = 0; i < 5; i++) replies.push(CAMentor.reply('hint', base({ problem: p }), state).text);
    replies.push(CAMentor.reply('show me the solution', base({ problem: p, solved: false }), {}).text);
    replies.push(CAMentor.reply('explain the approach and complexity', base({ problem: p }), {}).text);
    const joined = replies.join('\n');
    const own = Object.values(p.solutions).map((s) => s.split('\n')[0].trim());
    own.forEach((first) => assert.ok(!joined.includes(first), p.id + ' leaked: ' + first));
    // stronger: no multi-char solution line (other than ones also present in the hints) is in the output
    Object.values(p.solutions).forEach((s) => s.split('\n').forEach((l) => {
      const t = l.trim();
      if (t.length >= 12 && !p.hints.join('\n').includes(t)) assert.ok(!joined.includes(t), p.id + ' leaked line: ' + t);
    }));
  }
});

test('solution request is refused when unsolved and explained when solved', () => {
  const no = CAMentor.reply('explain the solution', base({ problem: twoSum, solved: false })).text;
  assert.ok(/after you have solved/.test(no));
  assert.ok(!no.includes(twoSum.editorial));
  const yes = CAMentor.reply('explain the solution', base({ problem: twoSum, solved: true })).text;
  assert.ok(yes.includes(twoSum.editorial));
  assert.ok(yes.includes(twoSum.complexity));
  assert.ok(!yes.includes('const seen = new Map'));
});

test('hint without an open problem asks to open one', () => {
  assert.ok(/Open a challenge/.test(CAMentor.reply('hint', base()).text));
});

test('hint state is safe against hostile problem ids', () => {
  const state = {};
  CAMentor.reply('hint', base({ problem: { id: '__proto__', title: 'x', hints: ['a', 'b'] } }), state);
  assert.equal(({}).polluted, undefined);
  assert.deepEqual(Object.keys(state.hints || {}), []);
});

const topicQs = {
  'big-o': 'what is big-o notation', 'binary-search': 'explain binary search', 'hash-map': 'how does a hash map work',
  recursion: 'explain recursion and base case', dp: 'what is dynamic programming', 'stack-queue': 'stack vs queue',
  trie: 'what is a trie', graph: 'explain bfs and dfs', dijkstra: 'how does dijkstra work', sorting: 'compare quicksort and merge sort',
  regex: 'how do regex work', xss: 'what is xss', sqli: 'what is sql injection', 'hash-vs-encrypt': 'hashing vs encryption',
  jwt: 'how does a jwt work', base64: 'what is base64', cors: 'what is cors', rest: 'explain rest api methods',
  closures: 'what is a closure', async: 'explain async await promise', 'gradient-descent': 'explain gradient descent',
  overfitting: 'what is overfitting', normalisation: 'what is database normalisation', indexes: 'how do database indexes work',
  acid: 'what does acid mean in a transaction', pagination: 'explain cursor pagination'
};
test('knowledge base answers every topic by keyword', () => {
  assert.ok(CAMentor.topics.length >= 25);
  for (const id of CAMentor.topics) {
    const q = topicQs[id];
    assert.ok(q, 'question for ' + id);
    const t = CAMentor.reply(q, base()).text;
    const topic = CAMentor.topicText()[CAMentor.topics.indexOf(id)];
    assert.ok(t.includes(topic), id + ' -> ' + t.slice(0, 60));
  }
});

const rev = (code, lang, problem) => CAMentor.reply('review my code', base({ code, lang: lang || 'js', problem })).text;

test('JS review heuristics fire', () => {
  const t = rev(`function f(nums, target, extra) {
  var out = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (nums[i] == target) console.log(i);
    }
  }
  nums.sort();
}`);
  assert.match(t, /Line 4: Nested loop/);
  assert.match(t, /Line 5: Loose equality/);
  assert.match(t, /Line 5: `console.log`/);
  assert.match(t, /Line 2: `var`/);
  assert.match(t, /never uses `return`/);
  assert.match(t, /Parameter `extra` is never used/);
  assert.match(t, /Line 8: This mutates the input `nums`/);
});

test('JS review: starter, empty body, recursion, long line, indexOf in loop', () => {
  assert.match(rev('function twoSum(nums, target) {\n  // Write your solution here\n  \n}\n'), /starter template/);
  assert.match(rev('function g(a) {\n}\n'), /empty body/);
  assert.match(rev('function r(n) {\n  return r(n - 1);\n}'), /no visible base case/);
  assert.match(rev('function h(a) {\n  return "' + 'x'.repeat(130) + '";\n}'), /Very long line/);
  assert.match(rev('function h(a) {\n  for (const x of a) {\n    if (a.indexOf(x) > 0) return x;\n  }\n  return null;\n}'), /indexOf.*O\(n\^2\)/);
});

test('JS review ignores strings and comments, and clean code passes', () => {
  const t = rev('function twoSum(nums, target) {\n  // var x == 1 console.log(1)\n  const s = "a == b var";\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const j = seen.get(target - nums[i]);\n    if (j !== undefined) return [j, i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}');
  assert.match(t, /found nothing to flag/);
  assert.ok(!/Line \d/.test(t));
});

test('Python review heuristics fire', () => {
  const t = rev(`def f(items, cache=[], unused=1):
    for a in items:
        for b in items:
            print(a)
    try:
        items.append(1)
    except:
        pass
    if items == None:
        pass
`, 'py');
  assert.match(t, /Nested loop/);
  assert.match(t, /Mutable default/);
  assert.match(t, /Bare `except:`/);
  assert.match(t, /`print` left in/);
  assert.match(t, /never uses `return`/);
  assert.match(rev('def g(items):\n    if items == None:\n        return 0\n    return 1\n', 'py'), /`None` with `is`/);
  assert.match(t, /mutates the input `items`/);
  assert.match(t, /Parameter `unused` is never used/);
  assert.match(rev('def two_sum(nums, target):\n    # Write your solution here\n    pass\n', 'py', twoSum), /only statement is `pass`/);
  assert.match(rev('def f(n):\n    return f(n - 1)\n', 'py'), /no `if` base case/);
});

test('review without code and honesty about limits', () => {
  assert.match(CAMentor.reply('review my code', base({ code: '   ' })).text, /do not see any code/);
  assert.match(rev('function a(x){return x}'), /cannot prove/);
});

test('plan recommends weakest track and real ids', () => {
  const st = core.createState();
  const solved = problems.filter((p) => p.category === 'algorithms').map((p) => p.id);
  solved.forEach((id) => { st.solved[id] = { at: 1, lang: 'js', attempts: 1, seconds: 60, xp: 25 }; });
  const s = core.stats(st, problems);
  const t = CAMentor.reply('what should I practise next?', { stats: s, problems, solvedIds: solved }).text;
  assert.match(t, /Weakest track/);
  assert.ok(!t.includes('Weakest track: **Algorithms**'));
  const ids = [...t.matchAll(/`open ([a-z0-9-]+)`/g)].map((m) => m[1]);
  assert.ok(ids.length > 0);
  ids.forEach((id) => { assert.ok(problems.some((p) => p.id === id)); assert.ok(!solved.includes(id)); });
  const t0 = CAMentor.reply('study plan', base()).text;
  assert.match(t0, /not solved anything/);
});

test('greeting, help and unknown input are honest', () => {
  for (const q of ['hi', 'help', 'what can you do?', 'are you an AI?', 'qwertyuiop asdf']) {
    const t = CAMentor.reply(q, base()).text;
    assert.match(t, /rule-based/);
    assert.match(t, /not an AI model/);
  }
});

test('robust to hostile and odd inputs', () => {
  for (const q of ['__proto__', 'constructor', '<script>alert(1)</script>', 'x'.repeat(10000), '日本語 😀', '', null, undefined, 42, '`'.repeat(50)]) {
    const r = CAMentor.reply(q, base({ problem: twoSum, code: '<img src=x onerror=alert(1)>' }), {});
    assert.equal(typeof r.text, 'string');
  }
  assert.equal(typeof CAMentor.reply('hint', null, null).text, 'string');
  assert.equal(typeof CAMentor.reply('review code', { code: 'x'.repeat(200000), lang: 'js' }).text, 'string');
  assert.equal(({}).polluted, undefined);
});

test('output never echoes user input and escapes to HTML without raw <', () => {
  const evil = '<script>alert(1)</script> hint review explain xss';
  const ctx = base({ problem: twoSum, code: 'function twoSum(a){ return "<img onerror=x>"; } // <b>' });
  const msgs = [evil, 'hint <b>', 'review my code <i>', 'what is xss <svg onload=1>', 'plan <u>', 'zzz <iframe>'];
  for (const m of msgs) {
    const t = CAMentor.reply(m, ctx, {}).text;
    assert.ok(!t.includes('<script>') && !t.includes('<svg') && !t.includes('<iframe'), m);
    const html = core.fmt(t).replace(/<\/?(code|strong)>/g, '');
    assert.ok(!html.includes('<'), 'raw < in ' + m);
  }
  // topic text itself escapes cleanly
  CAMentor.topicText().forEach((x) => assert.ok(!core.fmt(x).replace(/<\/?(code|strong)>/g, '').includes('<')));
});

test('honesty: no AI / GPT / LLM claims in canned text', () => {
  const canned = [CAMentor.capabilities(), ...CAMentor.topicText()];
  for (const q of ['hi', 'zzz', 'plan', 'hint', 'review']) canned.push(CAMentor.reply(q, base({ problem: twoSum, code: 'var x' }), {}).text);
  for (const text of canned) {
    assert.ok(!/\b(GPT|LLM|ChatGPT|Claude|neural|language model)\b/i.test(text), text.slice(0, 40));
    for (const m of text.matchAll(/\bAI\b/g)) {
      const ctxText = text.slice(Math.max(0, m.index - 12), m.index + 12);
      assert.ok(/not an AI/.test(ctxText), 'AI mention: ' + ctxText);
    }
  }
  assert.match(CAMentor.capabilities(), /rule-based/);
});
