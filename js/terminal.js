/*
 * Code Arsenal terminal: a real command interpreter over the catalogue and the learner's state.
 * Pure logic, no DOM. Output is plain text only; the UI must render it with textContent.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CATerminal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var MAX_LINE = 500, MAX_TOKENS = 20, MAX_HISTORY = 100, MAX_ECHO = 40;
  var CTRL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function L(text, kind) { return { text: String(text), kind: kind || 'out' }; }
  function shorten(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '...' : s; }
  function show(s) { return JSON.stringify(shorten(s, MAX_ECHO)); }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function closest(word, candidates) {
    var best = null, bestD = 1e9;
    candidates.forEach(function (c) {
      var d = levenshtein(word, c);
      if (d < bestD) { bestD = d; best = c; }
    });
    var limit = Math.max(2, Math.floor(word.length / 3));
    return best !== null && bestD <= limit ? best : null;
  }

  function create(opts) {
    opts = opts || {};
    var problems = opts.problems || [], store = opts.store, core = opts.core, navigate = typeof opts.navigate === 'function' ? opts.navigate : null;
    var byId = new Map();
    problems.forEach(function (p) { byId.set(p.id, p); });
    var ids = problems.map(function (p) { return p.id; });
    var history = [];
    var catById = new Map();
    core.CATEGORIES.forEach(function (c) { catById.set(c.id, c); });
    var diffById = new Map();
    core.DIFFICULTIES.forEach(function (d) { diffById.set(d.id, d); });

    function state() { return store.get(); }
    function isSolved(id) { return hasOwn(state().solved, id); }
    function today() { return core.dayKey(new Date()); }
    function stats() { return core.stats(state(), problems, Date.now()); }
    function err(text) { return { lines: [L(text, 'err')] }; }
    function ok(text) { return { lines: [L(text, 'ok')] }; }
    function out(lines) { return { lines: lines }; }

    function findProblem(token) {
      if (token === undefined) return { error: 'Missing challenge id. Try `list` to see ids.' };
      var id = String(token);
      if (byId.has(id)) return { problem: byId.get(id) };
      var lower = id.toLowerCase();
      if (byId.has(lower)) return { problem: byId.get(lower) };
      var near = closest(lower, ids);
      return { error: 'No challenge with id ' + show(id) + '.' + (near ? ' Did you mean ' + near + '?' : ' Run `list` to see all ids.') };
    }

    function row(p) {
      var d = diffById.get(p.difficulty);
      return (isSolved(p.id) ? '[x] ' : '[ ] ') + pad(p.id, 28) + ' ' + pad(d ? d.label : p.difficulty, 13) + p.title;
    }

    /* ------------------------------ commands ------------------------------ */
    var commands = new Map();
    function def(name, summary, usage, fn) { commands.set(name, { name: name, summary: summary, usage: usage, fn: fn }); }

    def('help', 'List commands, or describe one', 'help [command]', function (a) {
      if (a.length) {
        var key = a[0].toLowerCase();
        if (commands.has(key)) { var c = commands.get(key); return out([L(c.name + ': ' + c.summary), L('usage: ' + c.usage, 'dim')]); }
        return err('Unknown command ' + show(a[0]) + '.');
      }
      var lines = [L('Commands (type help <command> for usage):', 'dim')];
      commands.forEach(function (c) { lines.push(L('  ' + pad(c.name, 14) + c.summary)); });
      return out(lines);
    });

    function statusCmd() {
      var s = stats(), lines = [];
      lines.push(L(state().name + ' - level ' + s.level + ' ' + s.rank));
      lines.push(L('XP: ' + s.totalXP + ' (' + s.progress.into + '/' + s.progress.needed + ' to level ' + (s.level + 1) + ', ' + s.progress.percent + '%)'));
      lines.push(L('Solved: ' + s.solved + '/' + s.total + '   Success rate: ' + s.successRate + '%'));
      lines.push(L('Streak: ' + s.streak + ' day(s), best ' + s.bestStreak + '   XP this week: ' + s.weeklyXP));
      lines.push(L('Tracks:', 'dim'));
      core.CATEGORIES.forEach(function (c) {
        var pc = s.perCategory[c.id];
        lines.push(L('  ' + pad(c.id, 22) + pc.solved + '/' + pc.total));
      });
      return out(lines);
    }
    def('status', 'Show level, XP, solved counts and tracks', 'status', statusCmd);
    def('stats', 'Alias of status', 'stats', statusCmd);

    def('list', 'List challenges', 'list [track | difficulty | solved | unsolved]', function (a) {
      var f = a.length ? a[0].toLowerCase() : '', set = problems, label = 'all';
      if (f) {
        if (f === 'solved') set = problems.filter(function (p) { return isSolved(p.id); });
        else if (f === 'unsolved') set = problems.filter(function (p) { return !isSolved(p.id); });
        else if (diffById.has(f)) set = problems.filter(function (p) { return p.difficulty === f; });
        else if (catById.has(f)) set = problems.filter(function (p) { return p.category === f; });
        else {
          var m = core.CATEGORIES.filter(function (c) { return c.id.indexOf(f) === 0 || c.name.toLowerCase().indexOf(f) === 0; });
          if (m.length === 1) { set = problems.filter(function (p) { return p.category === m[0].id; }); f = m[0].id; }
          else {
            var names = core.CATEGORIES.map(function (c) { return c.id; }).concat(core.DIFFICULTIES.map(function (d) { return d.id; }), ['solved', 'unsolved']);
            var near = closest(f, names);
            return err('Unknown filter ' + show(a[0]) + '.' + (near ? ' Did you mean ' + near + '?' : ' Use a track, a difficulty, solved or unsolved.'));
          }
        }
        label = f;
      }
      if (!set.length) return out([L('No challenges match ' + label + '.', 'dim')]);
      var lines = set.map(function (p) { return L(row(p)); });
      lines.push(L(set.length + ' challenge(s). Use open <id> to start one.', 'dim'));
      return out(lines);
    });

    def('open', 'Open a challenge in the workspace', 'open <id>', function (a) {
      var r = findProblem(a[0]);
      if (r.error) return err(r.error);
      var res = { lines: [L('Opening ' + r.problem.title + '...', 'ok')], navigate: '#/challenge/' + r.problem.id };
      if (navigate) navigate(res.navigate);
      return res;
    });

    def('daily', 'Show today\'s daily challenge', 'daily', function () {
      var p = core.dailyProblem(problems, today());
      if (!p) return err('The catalogue is empty.');
      return out([L('Daily challenge for ' + today() + ':'), L(row(p)), L('Run open ' + p.id + ' to start.', 'dim')]);
    });

    def('hint', 'Show a hint for a challenge', 'hint <id> [n]', function (a) {
      var r = findProblem(a[0]);
      if (r.error) return err(r.error);
      var hints = r.problem.hints || [], n = 1;
      if (a.length > 1) {
        if (!/^\d{1,3}$/.test(a[1])) return err('Hint number must be a positive integer, got ' + show(a[1]) + '.');
        n = parseInt(a[1], 10);
      }
      if (n < 1 || n > hints.length) return err(r.problem.id + ' has ' + hints.length + ' hint(s); choose 1 to ' + hints.length + '.');
      var lines = [L('Hint ' + n + '/' + hints.length + ' for ' + r.problem.title + ':', 'dim'), L(hints[n - 1])];
      if (n < hints.length) lines.push(L('Next: hint ' + r.problem.id + ' ' + (n + 1), 'dim'));
      return out(lines);
    });

    def('langs', 'Show supported languages', 'langs', function () {
      var cur = state().settings.lang;
      return out(core.LANGS.map(function (l) { return L((l === cur ? '* ' : '  ') + pad(l, 4) + core.LANG_NAMES[l]); }));
    });

    def('achievements', 'Show unlocked and locked achievements', 'achievements', function () {
      var st = state(), lines = [], n = 0;
      core.ACHIEVEMENTS.forEach(function (a) {
        var got = hasOwn(st.achievements, a.id);
        if (got) n++;
        lines.push(L((got ? '[x] ' : '[ ] ') + pad(a.name, 18) + a.desc, got ? 'ok' : 'dim'));
      });
      lines.unshift(L(n + '/' + core.ACHIEVEMENTS.length + ' unlocked', 'dim'));
      return out(lines);
    });

    def('ranks', 'Show the rank ladder', 'ranks', function () {
      var lvl = stats().level;
      return out(core.RANKS.map(function (r, i) {
        var next = core.RANKS[i + 1], cur = lvl >= r.level && (!next || lvl < next.level);
        return L((cur ? '* ' : '  ') + pad('Level ' + r.level + '+', 11) + r.name + ' (' + core.xpForLevel(r.level) + ' XP)', cur ? 'ok' : 'out');
      }));
    });

    def('rank', 'Show your current rank and the next one', 'rank', function () {
      var s = stats(), lines = [L('Level ' + s.level + ': ' + s.rank, 'ok')];
      var next = core.RANKS.filter(function (r) { return r.level > s.level; })[0];
      if (next) lines.push(L('Next rank: ' + next.name + ' at level ' + next.level + ' (' + Math.max(0, core.xpForLevel(next.level) - s.totalXP) + ' XP to go)'));
      else lines.push(L('You hold the highest rank.', 'dim'));
      return out(lines);
    });

    def('streak', 'Show your daily streak', 'streak', function () {
      var s = stats(), st = state().streak;
      return out([L('Current streak: ' + s.streak + ' day(s)'), L('Best streak: ' + s.bestStreak + ' day(s)'), L('Last solve: ' + (st.last || 'never'), 'dim')]);
    });

    def('whoami', 'Show your profile', 'whoami', function () {
      var st = state(), s = stats();
      return out([L('name:     ' + st.name), L('level:    ' + s.level + ' (' + s.rank + ')'), L('language: ' + core.LANG_NAMES[st.settings.lang]), L('theme:    ' + st.settings.theme), L('since:    ' + new Date(st.created).toISOString().slice(0, 10))]);
    });

    def('set', 'Change a setting (name, lang)', 'set name <text> | set lang js|py', function (a, line) {
      var key = a.length ? a[0].toLowerCase() : '';
      if (key === 'name') {
        var m = /^\s*set\s+name\s+([\s\S]*)$/i.exec(line);
        var name = m ? m[1].trim() : '';
        if (!name) return err('Usage: set name <text> (1 to 40 characters).');
        if (name.length > 40) return err('Name is too long (' + name.length + ' characters, maximum 40).');
        if (CTRL.test(name)) return err('Name may not contain control characters.');
        store.update(function (s) { s.name = name; });
        return ok('Name set.');
      }
      if (key === 'lang') {
        var l = a.length > 1 ? a[1].toLowerCase() : '';
        if (core.LANGS.indexOf(l) < 0) return err('Usage: set lang js|py.');
        store.update(function (s) { s.settings.lang = l; });
        return ok('Default language set to ' + core.LANG_NAMES[l] + '.');
      }
      return err('Usage: set name <text> | set lang js|py.');
    });

    def('theme', 'Set the theme (light, dark, system)', 'theme light|dark|system', function (a) {
      var t = a.length ? a[0].toLowerCase() : '';
      if (['light', 'dark', 'system'].indexOf(t) < 0) return err('Usage: theme light|dark|system.');
      store.update(function (s) { s.settings.theme = t; });
      var res = ok('Theme set to ' + t + '.');
      res.theme = t;
      return res;
    });

    def('export', 'Export your progress as JSON', 'export', function () {
      var res = out([L('Progress exported (' + stats().solved + ' solved). Your browser will offer a download.', 'ok')]);
      res.download = store.exportJSON();
      return res;
    });

    def('reset', 'Erase all progress (needs --confirm)', 'reset --confirm', function (a) {
      if (a.length === 1 && a[0] === '--confirm') {
        store.reset();
        return ok('All progress erased.');
      }
      return out([L('This permanently erases your progress on this device.', 'err'), L('Run `export` first to keep a backup, then `reset --confirm`.', 'dim')]);
    });

    def('clear', 'Clear the screen', 'clear', function () { return { lines: [], clear: true }; });

    def('history', 'Show commands from this session', 'history', function () {
      if (!history.length) return out([L('No history yet.', 'dim')]);
      return out(history.map(function (h, i) { return L(pad(i + 1, 4) + shorten(h, 120)); }));
    });

    /* ------------------------------ exec ------------------------------ */
    function exec(line) {
      if (typeof line !== 'string') return err('Input must be text.');
      if (line.length > MAX_LINE) return err('Line too long (' + line.length + ' characters, maximum ' + MAX_LINE + ').');
      if (CTRL.test(line)) return err('Control characters are not allowed.');
      var trimmed = line.trim();
      if (!trimmed) return { lines: [] };
      history.push(trimmed);
      if (history.length > MAX_HISTORY) history.shift();
      var tokens = trimmed.split(/\s+/);
      if (tokens.length > MAX_TOKENS) return err('Too many arguments.');
      var name = tokens[0].toLowerCase();
      if (!commands.has(name)) {
        var near = closest(name, Array.from(commands.keys()));
        return err('Unknown command ' + show(tokens[0]) + '.' + (near ? ' Did you mean ' + near + '?' : '') + ' Type help for the list.');
      }
      try { return commands.get(name).fn(tokens.slice(1), trimmed); }
      catch (e) { return err('Command failed: ' + shorten(e && e.message ? e.message : 'unknown error', 80)); }
    }

    /* ------------------------------ completion ------------------------------ */
    function complete(partial) {
      if (typeof partial !== 'string' || partial.length > MAX_LINE) return [];
      var m = /^\s*(\S*)(\s+)?([\s\S]*)$/.exec(partial);
      var cmd = m[1].toLowerCase(), hasSpace = !!m[2], rest = m[3];
      var names = Array.from(commands.keys());
      if (!hasSpace) return names.filter(function (n) { return n.indexOf(cmd) === 0; }).sort();
      var pool = [];
      if ((cmd === 'open' || cmd === 'hint') && rest.indexOf(' ') < 0) pool = ids;
      else if (cmd === 'list') pool = Array.from(catById.keys()).concat(Array.from(diffById.keys()), ['solved', 'unsolved']);
      else if (cmd === 'theme') pool = ['light', 'dark', 'system'];
      else if (cmd === 'set') pool = rest.indexOf(' ') < 0 ? ['name', 'lang'] : (/^lang\s+\S*$/i.test(rest) ? core.LANGS.map(function (l) { return 'lang ' + l; }) : []);
      else if (cmd === 'help') pool = names;
      else if (cmd === 'reset') pool = ['--confirm'];
      var r = rest.toLowerCase();
      return pool.filter(function (p) { return p.toLowerCase().indexOf(r) === 0; }).sort().map(function (p) { return cmd + ' ' + p; });
    }

    return { exec: exec, complete: complete, history: function () { return history.slice(); }, commands: function () { return Array.from(commands.keys()); } };
  }

  return { create: create, levenshtein: levenshtein };
});
