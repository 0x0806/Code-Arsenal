const test = require('node:test');
const assert = require('node:assert/strict');
const { core, problems } = require('./load.js');
const CATerminal = require('../../js/terminal.js');

function make() {
  const store = core.createStore(problems);
  const nav = [];
  const t = CATerminal.create({ problems, store, core, navigate: (h) => nav.push(h) });
  return { t, store, nav };
}
const text = (r) => r.lines.map((l) => l.text).join('\n');
const kinds = new Set(['out', 'err', 'ok', 'dim']);

test('every command runs and yields valid lines', () => {
  const { t } = make();
  const id = problems[0].id;
  for (const c of ['help', 'help list', 'status', 'stats', 'list', 'list solved', 'list unsolved', 'list beginner', 'list algorithms', 'daily', `hint ${id}`, `hint ${id} 2`, 'langs', 'achievements', 'ranks', 'rank', 'streak', 'whoami', 'history', 'reset', 'clear', 'export', 'theme dark', 'set lang py']) {
    const r = t.exec(c);
    assert.ok(Array.isArray(r.lines), c);
    r.lines.forEach((l) => { assert.equal(typeof l.text, 'string'); assert.ok(kinds.has(l.kind), c); });
  }
});

test('list shows real ids, difficulty and solved marks', () => {
  const { t, store } = make();
  const p = problems[0];
  store.update((s) => { s.solved[p.id] = { at: 1, lang: 'js', attempts: 1, seconds: 60, xp: 25 }; });
  const all = text(t.exec('list'));
  problems.forEach((q) => assert.ok(all.includes(q.id)));
  assert.ok(all.includes('[x] ' + p.id));
  assert.ok(!text(t.exec('list unsolved')).includes('[x]'));
  assert.ok(text(t.exec('list solved')).includes(p.id));
  assert.equal(t.exec('list nonsense').lines[0].kind, 'err');
});

test('open navigates, validates ids and suggests', () => {
  const { t, nav } = make();
  const r = t.exec('open two-sum');
  assert.equal(r.navigate, '#/challenge/two-sum');
  assert.deepEqual(nav, ['#/challenge/two-sum']);
  const bad = t.exec('open two-sun');
  assert.equal(bad.lines[0].kind, 'err');
  assert.ok(bad.lines[0].text.includes('two-sum'));
  assert.equal(t.exec('open').lines[0].kind, 'err');
  assert.equal(t.exec('open nope').navigate, undefined);
});

test('hint tiers, bounds and defaults', () => {
  const { t } = make();
  const p = problems.find((x) => x.id === 'two-sum');
  assert.ok(text(t.exec('hint two-sum')).includes(p.hints[0]));
  assert.ok(text(t.exec('hint two-sum 2')).includes(p.hints[1]));
  assert.equal(t.exec('hint two-sum 99').lines[0].kind, 'err');
  assert.equal(t.exec('hint two-sum 0').lines[0].kind, 'err');
  assert.equal(t.exec('hint two-sum x').lines[0].kind, 'err');
});

test('status reflects real stats', () => {
  const { t, store } = make();
  store.update((s) => { s.solved['two-sum'] = { at: Date.now(), lang: 'js', attempts: 1, seconds: 60, xp: 30 }; });
  const s = text(t.exec('status'));
  assert.ok(s.includes('Solved: 1/' + problems.length));
  assert.ok(s.includes('XP: 30'));
});

test('daily matches core.dailyProblem', () => {
  const { t } = make();
  const d = core.dailyProblem(problems, core.dayKey(new Date()));
  assert.ok(text(t.exec('daily')).includes(d.id));
});

test('achievements show unlocked and locked', () => {
  const { t, store } = make();
  store.update((s) => { s.achievements['first-solve'] = 5; });
  const r = text(t.exec('achievements'));
  assert.ok(r.includes('1/' + core.ACHIEVEMENTS.length));
  assert.ok(r.includes('[x] First Blood'));
  assert.ok(r.includes('[ ] Warmed Up'));
});

test('set name validation', () => {
  const { t, store } = make();
  assert.equal(t.exec('set name Ada Lovelace').lines[0].kind, 'ok');
  assert.equal(store.get().name, 'Ada Lovelace');
  assert.equal(t.exec('set name').lines[0].kind, 'err');
  assert.equal(t.exec('set name ' + 'x'.repeat(41)).lines[0].kind, 'err');
  assert.equal(store.get().name, 'Ada Lovelace');
  assert.equal(t.exec('set name ' + 'x'.repeat(40)).lines[0].kind, 'ok');
  assert.equal(t.exec('set name <b>hi</b>').lines[0].kind, 'ok');
  assert.equal(store.get().name, '<b>hi</b>'); // stored as data; the UI escapes
  assert.equal(t.exec('set name a\u0007b').lines[0].kind, 'err');
});

test('set lang and theme', () => {
  const { t, store } = make();
  t.exec('set lang py');
  assert.equal(store.get().settings.lang, 'py');
  assert.equal(t.exec('set lang ruby').lines[0].kind, 'err');
  assert.equal(store.get().settings.lang, 'py');
  const r = t.exec('theme dark');
  assert.equal(r.theme, 'dark');
  assert.equal(store.get().settings.theme, 'dark');
  assert.equal(t.exec('theme neon').theme, undefined);
});

test('export returns parseable JSON', () => {
  const { t } = make();
  const r = t.exec('export');
  assert.equal(JSON.parse(r.download).v, 2);
});

test('reset requires --confirm', () => {
  const { t, store } = make();
  t.exec('set name Keep');
  t.exec('reset');
  t.exec('reset yes');
  t.exec('reset --confirm now');
  assert.equal(store.get().name, 'Keep');
  const r = t.exec('reset --confirm');
  assert.equal(r.lines[0].kind, 'ok');
  assert.equal(store.get().name, 'Learner');
});

test('clear and history', () => {
  const { t } = make();
  assert.equal(t.exec('clear').clear, true);
  t.exec('streak');
  assert.ok(text(t.exec('history')).includes('streak'));
  assert.ok(t.history().includes('clear'));
});

test('unknown command suggests closest', () => {
  const { t } = make();
  const r = t.exec('lst');
  assert.equal(r.lines[0].kind, 'err');
  assert.ok(r.lines[0].text.includes('list'));
  assert.ok(t.exec('statsu').lines[0].text.includes('stat'));
  assert.equal(t.exec('zzzzzzzzzz').lines[0].kind, 'err');
});

test('hostile inputs are handled as plain data', () => {
  const { t, store, nav } = make();
  const hostile = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '<script>alert(1)</script>', 'open __proto__', 'open constructor', 'hint __proto__', 'hint constructor 1', 'list __proto__', 'list constructor', 'set __proto__ x', 'help __proto__', 'help constructor', 'x'.repeat(10000), 'open ' + 'a'.repeat(499), '日本語 ✓ 😀', 'open 😀', 'set name 😀😀', '\u0000', 'list \u0007'];
  for (const h of hostile) {
    const r = t.exec(h);
    assert.ok(Array.isArray(r.lines));
    r.lines.forEach((l) => assert.ok(kinds.has(l.kind)));
    assert.equal(r.navigate, undefined, h);
  }
  assert.deepEqual(nav, []);
  assert.equal(t.exec('x'.repeat(10000)).lines[0].kind, 'err');
  assert.ok(t.exec('<script>alert(1)</script>').lines[0].text.length < 200);
  assert.equal(({}).polluted, undefined);
  assert.equal(store.get().name, '😀😀');
});

test('echoed input is truncated', () => {
  const { t } = make();
  const r = t.exec('open ' + 'q'.repeat(400));
  assert.ok(r.lines[0].text.length < 200);
});

test('complete', () => {
  const { t } = make();
  assert.deepEqual(t.complete('li'), ['list']);
  assert.ok(t.complete('open two').includes('open two-sum'));
  assert.ok(t.complete('theme d').includes('theme dark'));
  assert.deepEqual(t.complete('__proto__'), []);
  assert.deepEqual(t.complete('x'.repeat(1000)), []);
  assert.ok(t.complete('').length >= 10);
});

test('levenshtein', () => {
  assert.equal(CATerminal.levenshtein('kitten', 'sitting'), 3);
  assert.equal(CATerminal.levenshtein('', 'abc'), 3);
});
