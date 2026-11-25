const test = require('node:test');
const assert = require('node:assert/strict');
const { core, problems } = require('./load.js');

test('level curve is monotonic and matches thresholds', () => {
  assert.equal(core.levelFromXP(0), 1);
  assert.equal(core.levelFromXP(99), 1);
  assert.equal(core.levelFromXP(100), 2);
  assert.equal(core.levelFromXP(299), 2);
  assert.equal(core.levelFromXP(300), 3);
  let prev = 1;
  for (let xp = 0; xp < 20000; xp += 7) { const l = core.levelFromXP(xp); assert.ok(l >= prev); assert.ok(core.xpForLevel(l) <= xp); assert.ok(core.xpForLevel(l + 1) > xp); prev = l; }
  assert.equal(core.levelFromXP(-5), 1);
  assert.equal(core.levelFromXP(NaN), 1);
});

test('computeXP reports each modifier once', () => {
  const x = core.computeXP({ difficulty: 'advanced', attempts: 1, seconds: 100, streak: 0 });
  assert.deepEqual(x, { base: 100, speed: 20, attempts: 0, streak: 0, total: 120 });
  const y = core.computeXP({ difficulty: 'beginner', attempts: 4, seconds: 5000, streak: 20 });
  assert.equal(y.attempts, -7); assert.equal(y.streak, 5); assert.equal(y.total, 23);
  assert.ok(core.computeXP({ difficulty: 'beginner', attempts: 99, seconds: 99999, streak: 0 }).total >= 5);
});

test('a first solve awards XP exactly once, and replays award nothing', () => {
  const id = problems[0].id;
  const s0 = core.createState(1000);
  const r1 = core.applySubmission(s0, problems, { id, passed: true, seconds: 60, lang: 'js', now: 1000 });
  assert.ok(r1.firstSolve); assert.equal(core.totalXP(r1.state), r1.awarded.total);
  assert.equal(r1.state.xpLog.length, 1);
  const r2 = core.applySubmission(r1.state, problems, { id, passed: true, seconds: 10, lang: 'py', now: 2000 });
  assert.equal(r2.firstSolve, false); assert.equal(core.totalXP(r2.state), r1.awarded.total);
  assert.equal(r2.state.xpLog.length, 1);
  assert.equal(r2.state.accepted, 2); assert.equal(r2.state.submissions, 2);
});

test('failed submissions count attempts and lower the next award', () => {
  const p = problems.find((x) => x.difficulty === 'intermediate');
  let s = core.createState(0);
  for (let i = 0; i < 3; i++) s = core.applySubmission(s, problems, { id: p.id, passed: false, now: 5 }).state;
  assert.equal(s.attempts[p.id], 3); assert.equal(s.accepted, 0); assert.equal(s.submissions, 3);
  const r = core.applySubmission(s, problems, { id: p.id, passed: true, seconds: 2000, lang: 'js', now: 6 });
  assert.equal(r.awarded.attempts, -Math.round(p.xp * 0.3));
  assert.equal(r.state.solved[p.id].attempts, 4);
});

test('streak increments on consecutive days and resets after a gap', () => {
  let st = { current: 0, best: 0, last: '' };
  st = core.nextStreak(st, '2026-03-01'); assert.equal(st.current, 1);
  st = core.nextStreak(st, '2026-03-01'); assert.equal(st.current, 1);
  st = core.nextStreak(st, '2026-03-02'); assert.equal(st.current, 2);
  st = core.nextStreak(st, '2026-03-31'); assert.equal(st.current, 1); assert.equal(st.best, 2);
  assert.equal(core.nextStreak({ current: 4, best: 4, last: '2026-02-28' }, '2026-03-01').current, 5);
  assert.equal(core.liveStreak({ current: 4, best: 4, last: '2026-02-20' }, '2026-03-01'), 0);
});

test('unknown problem ids are rejected', () => {
  assert.throws(() => core.applySubmission(core.createState(), problems, { id: '__proto__', passed: true }));
});

test('sanitizeState survives hostile input', () => {
  const evil = JSON.parse('{"v":2,"name":"<img src=x onerror=alert(1)>","solved":{"__proto__":{"polluted":true},"constructor":{"x":1},"two-sum":{"at":1,"lang":"<b>","attempts":-5,"seconds":"abc","xp":99999999}},"drafts":{"two-sum:js":123,"__proto__:js":"x"},"xpLog":[{"id":"__proto__","xp":5,"at":1},{"id":"two-sum","xp":9e99,"at":"x"}],"settings":{"lang":"rb","theme":"<script>"},"achievements":{"__proto__":1,"first-solve":5},"lastOpened":"../../etc/passwd"}');
  const s = core.sanitizeState(evil, problems);
  assert.ok(s);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.keys(s.solved).join(), 'two-sum');
  assert.equal(s.solved['two-sum'].lang, 'js'); assert.equal(s.solved['two-sum'].attempts, 1); assert.ok(s.solved['two-sum'].xp <= 1000);
  assert.equal(s.xpLog.length, 1); assert.equal(s.xpLog[0].id, 'two-sum'); assert.ok(s.xpLog[0].xp <= 1000);
  assert.equal(s.settings.lang, 'js'); assert.equal(s.settings.theme, 'system');
  assert.equal(s.lastOpened, '');
  assert.deepEqual(Object.keys(s.achievements), ['first-solve']);
  assert.deepEqual(s.drafts, {});
  assert.equal(core.sanitizeState({ v: 1 }, problems), null);
  assert.equal(core.sanitizeState([], problems), null);
  assert.equal(core.sanitizeState(null, problems), null);
});

test('store rejects corrupt storage and bad imports', () => {
  const bag = { [core.STORAGE_KEY]: '{not json' };
  const store = core.createStore(problems, { getItem: (k) => bag[k] ?? null, setItem: (k, v) => { bag[k] = v; } });
  assert.equal(core.totalXP(store.get()), 0);
  assert.equal(store.importJSON('nope').ok, false);
  assert.equal(store.importJSON('{"v":1}').ok, false);
  assert.equal(store.importJSON('x'.repeat(6e6)).ok, false);
  store.update((s) => { s.name = 'Ada'; });
  assert.equal(JSON.parse(bag[core.STORAGE_KEY]).name, 'Ada');
  const copy = store.exportJSON();
  store.reset(); assert.equal(store.get().name, 'Learner');
  assert.ok(store.importJSON(copy).ok); assert.equal(store.get().name, 'Ada');
});

test('store tolerates throwing storage', () => {
  const store = core.createStore(problems, { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } });
  assert.doesNotThrow(() => store.update((s) => { s.name = 'x'; }));
});

test('escaping neutralises markup in every context', () => {
  const payload = '<img src=x onerror=alert(1)>"\'`&';
  const out = core.esc(payload);
  assert.ok(!/[<>"'`]/.test(out.replace(/&(lt|gt|quot|#39|#96|amp);/g, '')));
  const f = core.fmt('use `<b>` and **<i>x</i>**');
  assert.equal(f, 'use <code>&lt;b&gt;</code> and <strong>&lt;i&gt;x&lt;/i&gt;</strong>');
  assert.equal(core.esc(null), ''); assert.equal(core.esc(0), '0');
});

test('catalogue: every category is populated and the daily problem is stable', () => {
  assert.equal(problems.length, 41);
  core.CATEGORIES.forEach((c) => assert.ok(problems.filter((p) => p.category === c.id).length >= 5, c.id));
  assert.equal(core.dailyProblem(problems, '2026-05-05').id, core.dailyProblem(problems, '2026-05-05').id);
  const seen = new Set(); for (let d = 1; d < 29; d++) seen.add(core.dailyProblem(problems, '2026-02-' + String(d).padStart(2, '0')).id);
  assert.ok(seen.size > 10);
  problems.forEach((p) => { assert.match(p.starter.js, new RegExp('function ' + p.fn)); assert.match(p.starter.py, new RegExp('def ' + p.pyFn)); });
});

test('achievements unlock once', () => {
  const id = problems[0].id;
  const r = core.applySubmission(core.createState(1), problems, { id, passed: true, seconds: 30, lang: 'js', now: 1 });
  const names = r.newAchievements.map((a) => a.id).sort();
  assert.deepEqual(names, ['first-solve', 'first-try', 'speed']);
  const r2 = core.applySubmission(r.state, problems, { id, passed: true, seconds: 30, lang: 'js', now: 2 });
  assert.equal(r2.newAchievements.length, 0);
});
