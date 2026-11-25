/* Landing page: counts and lists come from the real catalogue; the miniature ticks once. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  // Honour a saved theme (defensively).
  try {
    var raw = window.localStorage.getItem('codeArsenal.v2');
    var theme = raw && JSON.parse(raw).settings.theme;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  } catch (e) { /* storage unavailable or malformed: follow the system */ }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var Core = window.CACore, reg = window.CA_PROBLEMS_REG;
  var problems = null;
  try { if (Core && reg && Core.buildProblems) problems = Core.buildProblems(reg); } catch (e) { problems = null; }

  function $(s) { return document.querySelector(s); }
  function bind(name, text) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-bind="' + name + '"]'), function (n) { n.textContent = text; });
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function show(v) { return JSON.stringify(v).replace(/,/g, ', '); }

  function testRow(problem, t, state, hiddenWord) {
    var li = el('li', t.hidden ? 't t-hidden' : 't');
    li.setAttribute('data-s', state);
    li.appendChild(el('span', 'mark'));
    if (t.hidden) {
      li.appendChild(el('span', 'call', 'Hidden test'));
      li.appendChild(el('span', 'exp', hiddenWord));
    } else {
      li.appendChild(el('code', 'call', problem.fn + '(' + t.args.map(show).join(', ') + ')'));
      li.appendChild(el('code', 'exp', show(t.expected)));
    }
    return li;
  }

  if (problems && problems.length) {
    var n = Core.CATEGORIES.length;
    var langs = Core.LANGS.map(function (l) { return Core.LANG_NAMES[l]; }).join(', ');
    bind('problems', String(problems.length));
    bind('tracks', String(n));
    bind('langs', langs);
    bind('ach-count', String(Core.ACHIEVEMENTS.length));
    bind('demo-level', '12');
    bind('demo-xp', Core.xpForLevel(12).toLocaleString('en-US'));

    // Tracks, from CACore.CATEGORIES with true counts and the first problems of each (by difficulty).
    var list = $('#track-list');
    if (list) {
      list.textContent = '';
      Core.CATEGORIES.forEach(function (c) {
        var ps = problems.filter(function (p) { return p.category === c.id; });
        // one beginner, one middle, one hardest, so the range shows
        var pick = [ps[0], ps[Math.floor(ps.length / 2)], ps[ps.length - 1]].filter(function (p, i, a) { return a.indexOf(p) === i; });
        var li = el('li');
        li.appendChild(el('span', 'tn', String(ps.length)));
        var tt = el('div', 'tt'); tt.appendChild(el('h3', '', c.name)); tt.appendChild(el('p', '', c.blurb)); li.appendChild(tt);
        li.appendChild(el('p', 'tp', pick.map(function (p) { return p.title; }).join(', ')));
        list.appendChild(li);
      });
    }

    // XP per difficulty
    var xl = $('#xp-list');
    if (xl) {
      xl.textContent = '';
      Core.DIFFICULTIES.forEach(function (d) { var li = el('li'); li.appendChild(el('span', '', d.label)); li.appendChild(el('b', '', d.xp + ' XP')); xl.appendChild(li); });
    }
    var al = $('#ach-list');
    if (al) al.textContent = Core.ACHIEVEMENTS.map(function (a) { return a.name; }).join(', ') + '.';

    // Ranks
    var st = $('#stairs');
    if (st) {
      st.textContent = '';
      Core.RANKS.forEach(function (r, i) {
        var li = el('li'); li.style.setProperty('--i', String(i));
        li.appendChild(el('span', 'sx', Core.xpForLevel(r.level).toLocaleString('en-US') + ' XP'));
        li.appendChild(el('span', 'sr', r.name));
        li.appendChild(el('span', 'sl', 'Level ' + r.level));
        st.appendChild(li);
      });
      st.style.setProperty('--n', String(Core.RANKS.length));
    }

    // Two Sum: the miniature and the judged result use its real tests.
    var two = problems.filter(function (p) { return p.id === 'two-sum'; })[0];
    if (two) {
      var wt = $('#ws-tests'), rt = $('#result-tests');
      if (wt) { wt.textContent = ''; two.tests.forEach(function (t) { wt.appendChild(testRow(two, t, 'ok', 'hidden')); }); }
      if (rt) {
        // Run the real scorer on a submission whose first hidden test returns the wrong answer.
        var failAt = -1, tests = two.tests;
        tests.forEach(function (t, i) { if (failAt < 0 && t.hidden) failAt = i; });
        var raw = { status: 'done', logs: [], results: tests.map(function (t, i) { return { actual: i === failAt ? [] : t.expected, ms: 0 }; }) };
        var scored = window.CAJudge ? window.CAJudge.scoreResults({ tests: tests }, raw) : null;
        rt.textContent = '';
        tests.forEach(function (t, i) {
          var ok = scored ? scored.results[i].passed : i !== failAt;
          rt.appendChild(testRow(two, t, ok ? 'ok' : 'fail', ok ? 'passed' : 'failed'));
        });
        var passed = scored ? scored.passedCount : tests.length - 1;
        var v = $('#result-verdict'); if (v) v.textContent = passed + ' of ' + tests.length + ' passed';
        var h = $('#result-h'); if (h) h.textContent = 'Result for ' + two.title;
      }
      var xp = $('#ws-xp'); if (xp) xp.textContent = '+' + two.xp + ' XP';
    }
  }

  // Hero entrance of the test list: failing to passing, once.
  var ws = $('#ws'), wl = $('#ws-tests'), cnt = $('#ws-count');
  if (ws && wl && !reduce) {
    var rows = Array.prototype.slice.call(wl.children), total = rows.length;
    rows.forEach(function (r) { r.setAttribute('data-s', 'fail'); });
    ws.setAttribute('data-run', 'fail');
    cnt.textContent = '0 of ' + total + ' passing';
    rows.forEach(function (r, i) {
      window.setTimeout(function () {
        r.setAttribute('data-s', 'ok');
        cnt.textContent = (i + 1) + ' of ' + total + ' passing';
        if (i === total - 1) ws.removeAttribute('data-run');
      }, 900 + i * 260);
    });
  } else if (cnt && wl) {
    cnt.textContent = wl.children.length + ' of ' + wl.children.length + ' passing';
  }

  // Dealt moment: the rank stairs rise once when they scroll into view.
  var stairs = $('#stairs');
  if (stairs) {
    if (reduce || !('IntersectionObserver' in window)) stairs.classList.add('in');
    else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { stairs.classList.add('in'); io.disconnect(); } });
      }, { threshold: 0.25 });
      io.observe(stairs);
    }
  }
})();
