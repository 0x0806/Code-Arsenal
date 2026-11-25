/*
 * Code Arsenal core: problem catalogue, XP and levels, achievements, validated persistence.
 * Pure logic only. No DOM access, so it runs unchanged in Node tests.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CACore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var STORAGE_KEY = 'codeArsenal.v2';
  var MAX_CODE_LENGTH = 50000;
  var MAX_LOG = 5000;

  var CATEGORIES = [
    { id: 'algorithms', name: 'Algorithms', blurb: 'Searching, graphs, intervals and backtracking.' },
    { id: 'data-structures', name: 'Data Structures', blurb: 'Stacks, caches, tries and frequency tables.' },
    { id: 'dynamic-programming', name: 'Dynamic Programming', blurb: 'Break problems into reusable subproblems.' },
    { id: 'machine-learning', name: 'Machine Learning', blurb: 'Core numeric building blocks, written from scratch.' },
    { id: 'web-development', name: 'Web Development', blurb: 'Parsing, templating and UI utilities.' },
    { id: 'databases', name: 'Databases', blurb: 'Joins, grouping and window logic without a database.' },
    { id: 'cybersecurity', name: 'Cybersecurity', blurb: 'Encoding, hashing, tokens and safe output.' },
    { id: 'mobile-development', name: 'Mobile Development', blurb: 'Pagination, sync, reducers and retry logic.' }
  ];

  var DIFFICULTIES = [
    { id: 'beginner', label: 'Beginner', xp: 25 },
    { id: 'intermediate', label: 'Intermediate', xp: 50 },
    { id: 'advanced', label: 'Advanced', xp: 100 },
    { id: 'expert', label: 'Expert', xp: 200 }
  ];

  var RANKS = [
    { level: 1, name: 'Rookie' }, { level: 3, name: 'Code Cadet' }, { level: 5, name: 'Developer' },
    { level: 8, name: 'Code Warrior' }, { level: 12, name: 'Senior Developer' }, { level: 16, name: 'Tech Lead' },
    { level: 22, name: 'Code Master' }, { level: 30, name: 'Programming Guru' }, { level: 40, name: 'Code Legend' }
  ];

  var LANGS = ['js', 'py'];
  var LANG_NAMES = { js: 'JavaScript', py: 'Python' };

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clampInt(n, lo, hi) { n = Math.floor(Number(n)); if (!isFinite(n)) return lo; return Math.min(hi, Math.max(lo, n)); }
  function isStr(s, max) { return typeof s === 'string' && s.length <= (max || 200); }

  /* ------------------------------ escaping / formatting ------------------------------ */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  /** Escape any value for safe insertion into HTML text or a quoted attribute. */
  function esc(value) { return String(value === null || value === undefined ? '' : value).replace(/[&<>"'`]/g, function (c) { return ESC[c]; }); }
  /** Escape first, then allow only `code` and **bold**. Output is safe to assign to innerHTML. */
  function fmt(text) {
    return String(text === null || text === undefined ? '' : text).replace(/[&<>"']/g, function (c) { return ESC[c]; }).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  }

  /* ------------------------------------ problems ------------------------------------ */
  function buildProblems(reg) {
    var catOrder = {}; CATEGORIES.forEach(function (c, i) { catOrder[c.id] = i; });
    var diffOrder = {}; DIFFICULTIES.forEach(function (d, i) { diffOrder[d.id] = i; });
    var judge = root.CAJudge || (typeof require === 'function' ? require('./judge.js') : null);
    var list = reg.map(function (p) {
      var pyFn = judge.toSnake(p.fn);
      var pyParams = p.params.map(judge.toSnake);
      return Object.freeze({
        id: p.id, title: p.title, category: p.category, difficulty: p.difficulty, summary: p.summary,
        statement: p.statement, examples: p.examples, constraints: p.constraints, hints: p.hints,
        complexity: p.complexity, editorial: p.editorial, tests: p.tests, solutions: p.solutions,
        fn: p.fn, pyFn: pyFn, params: p.params, pyParams: pyParams,
        xp: DIFFICULTIES[diffOrder[p.difficulty]].xp,
        starter: {
          js: 'function ' + p.fn + '(' + p.params.join(', ') + ') {\n  // Write your solution here\n  \n}\n',
          py: 'def ' + pyFn + '(' + pyParams.join(', ') + '):\n    # Write your solution here\n    pass\n'
        }
      });
    });
    list.sort(function (a, b) {
      return catOrder[a.category] - catOrder[b.category] || diffOrder[a.difficulty] - diffOrder[b.difficulty] || (a.title < b.title ? -1 : 1);
    });
    return list;
  }

  /* ------------------------------------ XP and levels ------------------------------------ */
  function xpForLevel(level) { level = Math.max(1, Math.floor(level)); return 50 * level * (level - 1); }
  function levelFromXP(xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    var lvl = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
    while (xpForLevel(lvl + 1) <= xp) lvl++;
    while (lvl > 1 && xpForLevel(lvl) > xp) lvl--;
    return lvl;
  }
  function rankForLevel(level) {
    var name = RANKS[0].name;
    RANKS.forEach(function (r) { if (level >= r.level) name = r.name; });
    return name;
  }
  function levelProgress(totalXP) {
    var level = levelFromXP(totalXP), floor = xpForLevel(level), ceil = xpForLevel(level + 1);
    return { level: level, rank: rankForLevel(level), into: totalXP - floor, needed: ceil - floor, percent: Math.round(((totalXP - floor) / (ceil - floor)) * 100), nextLevelXP: ceil };
  }

  /** XP for a first-time solve. Each modifier is reported separately so the UI can show it once. */
  function computeXP(opts) {
    var diff = DIFFICULTIES.filter(function (d) { return d.id === opts.difficulty; })[0] || DIFFICULTIES[0];
    var base = diff.xp;
    var seconds = Math.max(1, Math.floor(opts.seconds || 1));
    var speedPct = seconds < 300 ? 20 : seconds < 900 ? 10 : 0;
    var failed = Math.max(0, Math.floor((opts.attempts || 1) - 1));
    var attemptPct = -Math.min(50, failed * 10);
    var streakPct = Math.min(20, Math.max(0, Math.floor(opts.streak || 0)) * 2);
    var speed = Math.round((base * speedPct) / 100) || 0, attempt = Math.round((base * attemptPct) / 100) || 0, streak = Math.round((base * streakPct) / 100) || 0;
    return { base: base, speed: speed, attempts: attempt, streak: streak, total: Math.max(5, base + speed + attempt + streak) };
  }

  /* ------------------------------------ dates and streaks ------------------------------------ */
  function dayKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function addDays(key, n) { var p = key.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return dayKey(d); }
  function nextStreak(streak, today) {
    if (streak.last === today) return { current: streak.current, best: streak.best, last: today };
    var current = streak.last === addDays(today, -1) ? streak.current + 1 : 1;
    return { current: current, best: Math.max(streak.best, current), last: today };
  }
  /** The streak a user should see now: it lapses if yesterday was missed. */
  function liveStreak(streak, today) {
    if (!streak.last) return 0;
    return streak.last === today || streak.last === addDays(today, -1) ? streak.current : 0;
  }
  function dailyProblem(problems, key) {
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return problems[h % problems.length];
  }

  /* ------------------------------------ state ------------------------------------ */
  function createState(now) {
    return {
      v: 2, name: 'Learner', created: now || Date.now(),
      solved: {}, attempts: {}, opened: {}, drafts: {}, xpLog: [], achievements: {},
      submissions: 0, accepted: 0,
      streak: { current: 0, best: 0, last: '' },
      settings: { lang: 'js', theme: 'system' },
      lastOpened: ''
    };
  }

  /** Rebuild a state object from untrusted JSON. Only known problem ids and fields survive. */
  function sanitizeState(raw, problems) {
    var s = createState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== 2) return null;
    var ids = {}; problems.forEach(function (p) { ids[p.id] = p; });
    if (isStr(raw.name, 40) && raw.name.trim()) s.name = raw.name.trim();
    s.created = clampInt(raw.created, 0, 4102444800000) || s.created;
    s.submissions = clampInt(raw.submissions, 0, 1e7);
    s.accepted = clampInt(raw.accepted, 0, s.submissions || 1e7);
    problems.forEach(function (p) {
      var sv = raw.solved && hasOwn(raw.solved, p.id) ? raw.solved[p.id] : null;
      if (sv && typeof sv === 'object') {
        s.solved[p.id] = {
          at: clampInt(sv.at, 0, 4102444800000), lang: LANGS.indexOf(sv.lang) >= 0 ? sv.lang : 'js',
          attempts: clampInt(sv.attempts, 1, 1e4), seconds: clampInt(sv.seconds, 1, 1e7), xp: clampInt(sv.xp, 0, 1000)
        };
      }
      if (raw.attempts && hasOwn(raw.attempts, p.id)) s.attempts[p.id] = clampInt(raw.attempts[p.id], 0, 1e4);
      if (raw.opened && hasOwn(raw.opened, p.id)) s.opened[p.id] = clampInt(raw.opened[p.id], 0, 4102444800000);
      LANGS.forEach(function (l) {
        var k = p.id + ':' + l;
        if (raw.drafts && hasOwn(raw.drafts, k) && isStr(raw.drafts[k], MAX_CODE_LENGTH)) s.drafts[k] = raw.drafts[k];
      });
    });
    if (Array.isArray(raw.xpLog)) {
      raw.xpLog.slice(-MAX_LOG).forEach(function (e) {
        if (e && typeof e === 'object' && hasOwn(ids, String(e.id))) s.xpLog.push({ at: clampInt(e.at, 0, 4102444800000), xp: clampInt(e.xp, 0, 1000), id: String(e.id) });
      });
    }
    var st = raw.streak;
    if (st && typeof st === 'object') {
      s.streak = { current: clampInt(st.current, 0, 36500), best: clampInt(st.best, 0, 36500), last: /^\d{4}-\d{2}-\d{2}$/.test(String(st.last)) ? String(st.last) : '' };
      if (s.streak.best < s.streak.current) s.streak.best = s.streak.current;
    }
    ACHIEVEMENTS.forEach(function (a) {
      if (raw.achievements && hasOwn(raw.achievements, a.id)) s.achievements[a.id] = clampInt(raw.achievements[a.id], 0, 4102444800000);
    });
    if (raw.settings && typeof raw.settings === 'object') {
      if (LANGS.indexOf(raw.settings.lang) >= 0) s.settings.lang = raw.settings.lang;
      if (['system', 'light', 'dark'].indexOf(raw.settings.theme) >= 0) s.settings.theme = raw.settings.theme;
    }
    if (isStr(raw.lastOpened, 80) && hasOwn(ids, raw.lastOpened)) s.lastOpened = raw.lastOpened;
    return s;
  }

  function totalXP(state) { var t = 0; for (var k in state.solved) if (hasOwn(state.solved, k)) t += state.solved[k].xp; return t; }

  function stats(state, problems, now) {
    var today = dayKey(now || Date.now());
    var xp = totalXP(state), lp = levelProgress(xp);
    var cutoff7 = (now || Date.now()) - 7 * 864e5, cutoff30 = (now || Date.now()) - 30 * 864e5;
    var weekly = 0, monthly = 0;
    state.xpLog.forEach(function (e) { if (e.at >= cutoff7) weekly += e.xp; if (e.at >= cutoff30) monthly += e.xp; });
    var perCategory = {};
    CATEGORIES.forEach(function (c) { perCategory[c.id] = { solved: 0, total: 0, xp: 0 }; });
    problems.forEach(function (p) {
      perCategory[p.category].total++;
      if (hasOwn(state.solved, p.id)) { perCategory[p.category].solved++; perCategory[p.category].xp += state.solved[p.id].xp; }
    });
    var solvedIds = Object.keys(state.solved), langs = {}, fastest = null, secondsSum = 0;
    solvedIds.forEach(function (id) {
      langs[state.solved[id].lang] = true;
      secondsSum += state.solved[id].seconds;
      if (fastest === null || state.solved[id].seconds < fastest) fastest = state.solved[id].seconds;
    });
    return {
      totalXP: xp, level: lp.level, rank: lp.rank, progress: lp, solved: solvedIds.length, total: problems.length,
      successRate: state.submissions ? Math.round((state.accepted / state.submissions) * 100) : 0,
      streak: liveStreak(state.streak, today), bestStreak: state.streak.best, languages: Object.keys(langs).length,
      weeklyXP: weekly, monthlyXP: monthly, fastest: fastest, averageSeconds: solvedIds.length ? Math.round(secondsSum / solvedIds.length) : 0,
      perCategory: perCategory
    };
  }

  /* ------------------------------------ achievements ------------------------------------ */
  var ACHIEVEMENTS = [
    { id: 'first-solve', name: 'First Blood', desc: 'Solve your first challenge.', icon: 'flag', test: function (c) { return c.stats.solved >= 1; } },
    { id: 'solve-5', name: 'Warmed Up', desc: 'Solve 5 challenges.', icon: 'flame', test: function (c) { return c.stats.solved >= 5; } },
    { id: 'solve-15', name: 'In the Groove', desc: 'Solve 15 challenges.', icon: 'bolt', test: function (c) { return c.stats.solved >= 15; } },
    { id: 'solve-30', name: 'Workhorse', desc: 'Solve 30 challenges.', icon: 'layers', test: function (c) { return c.stats.solved >= 30; } },
    { id: 'solve-all', name: 'Arsenal Complete', desc: 'Solve every challenge.', icon: 'crown', test: function (c) { return c.stats.solved === c.stats.total; } },
    { id: 'first-try', name: 'Clean Run', desc: 'Solve a challenge on your first submission.', icon: 'target', test: function (c) { return c.solve && c.solve.attempts === 1; } },
    { id: 'speed', name: 'Quick Draw', desc: 'Solve a challenge in under two minutes.', icon: 'timer', test: function (c) { return c.solve && c.solve.seconds < 120; } },
    { id: 'expert', name: 'Deep End', desc: 'Solve an expert challenge.', icon: 'mountain', test: function (c) { return c.solvedProblem && c.solvedProblem.difficulty === 'expert'; } },
    { id: 'polyglot', name: 'Polyglot', desc: 'Solve challenges in both JavaScript and Python.', icon: 'languages', test: function (c) { return c.stats.languages >= 2; } },
    { id: 'streak-3', name: 'Three in a Row', desc: 'Reach a 3-day streak.', icon: 'calendar', test: function (c) { return c.stats.streak >= 3; } },
    { id: 'streak-7', name: 'Full Week', desc: 'Reach a 7-day streak.', icon: 'calendar-check', test: function (c) { return c.stats.streak >= 7; } },
    { id: 'level-5', name: 'Level 5', desc: 'Reach level 5.', icon: 'trending', test: function (c) { return c.stats.level >= 5; } },
    { id: 'level-10', name: 'Level 10', desc: 'Reach level 10.', icon: 'trending', test: function (c) { return c.stats.level >= 10; } },
    { id: 'track-complete', name: 'Track Complete', desc: 'Solve every challenge in one track.', icon: 'check-circle', test: function (c) {
      return CATEGORIES.some(function (k) { var p = c.stats.perCategory[k.id]; return p.total > 0 && p.solved === p.total; });
    } }
  ];

  /**
   * Record the outcome of a submission. Returns a new state plus what changed.
   * XP is awarded once per problem; solving again later is allowed but earns nothing.
   */
  function applySubmission(prev, problems, input) {
    var state = JSON.parse(JSON.stringify(prev));
    var now = input.now || Date.now();
    var problem = problems.filter(function (p) { return p.id === input.id; })[0];
    if (!problem) throw new Error('Unknown problem: ' + input.id);
    var result = { state: state, awarded: null, newAchievements: [], leveledUp: false, firstSolve: false, level: 0 };
    var before = levelFromXP(totalXP(state));
    state.submissions++;
    if (!input.passed) {
      state.attempts[problem.id] = (state.attempts[problem.id] || 0) + 1;
      result.level = before;
      return result;
    }
    state.accepted++;
    var attempts = (state.attempts[problem.id] || 0) + 1;
    var today = dayKey(now);
    state.streak = nextStreak(state.streak, today);
    if (!hasOwn(state.solved, problem.id)) {
      var seconds = Math.max(1, Math.floor(input.seconds || 1));
      var award = computeXP({ difficulty: problem.difficulty, attempts: attempts, seconds: seconds, streak: state.streak.current - 1 });
      state.solved[problem.id] = { at: now, lang: input.lang === 'py' ? 'py' : 'js', attempts: attempts, seconds: seconds, xp: award.total };
      state.xpLog.push({ at: now, xp: award.total, id: problem.id });
      if (state.xpLog.length > MAX_LOG) state.xpLog = state.xpLog.slice(-MAX_LOG);
      result.awarded = award;
      result.firstSolve = true;
    }
    var st = stats(state, problems, now);
    var ctx = { stats: st, solve: result.firstSolve ? state.solved[problem.id] : null, solvedProblem: result.firstSolve ? problem : null, state: state };
    ACHIEVEMENTS.forEach(function (a) {
      if (!hasOwn(state.achievements, a.id) && a.test(ctx)) { state.achievements[a.id] = now; result.newAchievements.push(a); }
    });
    result.level = st.level;
    result.leveledUp = st.level > before;
    return result;
  }

  /* ------------------------------------ persistence ------------------------------------ */
  /** Storage wrapper. Every read is validated; any failure falls back to a fresh state. */
  function createStore(problems, storage) {
    var mem = {}, listeners = [];
    var backend = storage || {
      getItem: function (k) { return hasOwn(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); }
    };
    var state = load();
    function load() {
      try {
        var text = backend.getItem(STORAGE_KEY);
        if (text && text.length < 5e6) {
          var s = sanitizeState(JSON.parse(text), problems);
          if (s) return s;
        }
      } catch (e) { /* fall through */ }
      return createState();
    }
    function save() { try { backend.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
    function emit() { listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* listener errors must not break the store */ } }); }
    return {
      get: function () { return state; },
      set: function (next) { state = next; save(); emit(); },
      update: function (fn) { var copy = JSON.parse(JSON.stringify(state)); fn(copy); this.set(copy); },
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
      exportJSON: function () { return JSON.stringify(state, null, 2); },
      importJSON: function (text) {
        if (typeof text !== 'string' || text.length > 5e6) return { ok: false, error: 'File is too large.' };
        var parsed;
        try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not valid JSON.' }; }
        var s = sanitizeState(parsed, problems);
        if (!s) return { ok: false, error: 'That file is not a Code Arsenal backup.' };
        state = s; save(); emit();
        return { ok: true };
      },
      reset: function () { state = createState(); save(); emit(); }
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY, MAX_CODE_LENGTH: MAX_CODE_LENGTH, CATEGORIES: CATEGORIES, DIFFICULTIES: DIFFICULTIES, RANKS: RANKS,
    ACHIEVEMENTS: ACHIEVEMENTS, LANGS: LANGS, LANG_NAMES: LANG_NAMES,
    esc: esc, fmt: fmt, buildProblems: buildProblems, xpForLevel: xpForLevel, levelFromXP: levelFromXP, rankForLevel: rankForLevel,
    levelProgress: levelProgress, computeXP: computeXP, dayKey: dayKey, addDays: addDays, nextStreak: nextStreak, liveStreak: liveStreak,
    dailyProblem: dailyProblem, createState: createState, sanitizeState: sanitizeState, totalXP: totalXP, stats: stats,
    applySubmission: applySubmission, createStore: createStore
  };
});
