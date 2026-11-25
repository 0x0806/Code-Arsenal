/* Code Arsenal app: shell, router and views. Classic script. All dynamic strings are escaped or set via textContent. */
(function () {
  'use strict';

  var C = window.CACore, I = window.CAIcons;
  var root = document.documentElement;
  var view = document.getElementById('view');
  if (!C || !I || !window.CA_PROBLEMS_REG || !window.CAJudge) {
    view.textContent = 'The app could not load its core files. Reload the page; if this continues, check that JavaScript files are not blocked.';
    return;
  }
  var esc = C.esc;
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ic = function (n, o) { return I.svg(n, o); };

  var problems = C.buildProblems(window.CA_PROBLEMS_REG);
  var byId = {};
  problems.forEach(function (p) { byId[p.id] = p; });
  var catName = {}; C.CATEGORIES.forEach(function (c) { catName[c.id] = c.name; });
  var diffIdx = {}, diffLabel = {};
  C.DIFFICULTIES.forEach(function (d, i) { diffIdx[d.id] = i; diffLabel[d.id] = d.label; });

  /* ------------------------------ storage and store ------------------------------ */
  var storage, storageOk = true;
  try { storage = window.localStorage; storage.setItem('__ca_t', '1'); storage.removeItem('__ca_t'); } catch (e) { storage = undefined; storageOk = false; }
  var store = C.createStore(problems, storage);
  if (/[?&]e2e=1/.test(location.search)) window.__CA_APP__ = { store: store, problems: problems };

  var sessionOpened = {};      // problem id -> ms when first opened in this session
  var hintsShown = {};         // problem id -> number of hints revealed (memory only)
  var lastWsId = '';           // last problem opened in the workspace this session
  var mentorState = {};
  var chatLog = [];
  var mentorCtxOn = true;
  var termLog = [], inputHist = [], termWelcomed = false, term = null;

  /* ------------------------------ small helpers ------------------------------ */
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return C.dayKey(ts); }
  }
  function fmtDur(sec) {
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ' + ('0' + (sec % 60)).slice(-2) + 's';
    return Math.floor(sec / 3600) + 'h ' + ('0' + Math.floor((sec % 3600) / 60)).slice(-2) + 'm';
  }
  function num(n) { return Number(n || 0).toLocaleString(); }
  function isSolved(id) { return has(store.get().solved, id); }
  function statusOf(p) {
    var s = store.get();
    if (has(s.solved, p.id)) return 'solved';
    if ((s.attempts[p.id] || 0) > 0 || has(s.drafts, p.id + ':js') || has(s.drafts, p.id + ':py')) return 'attempted';
    return 'todo';
  }
  var STATUS_LABEL = { solved: 'Solved', attempted: 'Attempted', todo: 'Not started' };
  function statusHTML(p) {
    var k = statusOf(p);
    var icon = k === 'solved' ? 'check-circle' : k === 'attempted' ? 'half' : 'circle';
    return '<span class="st ' + k + '">' + ic(icon, { size: 16 }) + STATUS_LABEL[k] + '</span>';
  }
  function diffHTML(p) {
    var n = diffIdx[p.difficulty] + 1, b = '';
    for (var i = 1; i <= 4; i++) b += '<b' + (i <= n ? ' class="on"' : '') + '></b>';
    return '<span class="diff"><i aria-hidden="true">' + b + '</i>' + esc(diffLabel[p.difficulty]) + '</span>';
  }
  function bar(pct, cls, label) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    return '<div class="bar ' + (cls || '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(label) + '"><i style="width:' + pct + '%"></i></div>';
  }
  function announce(text) {
    var l = document.getElementById('live');
    l.textContent = '';
    setTimeout(function () { l.textContent = text; }, 40);
  }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function nextUnsolved(p) {
    var i = problems.indexOf(p);
    for (var k = 1; k < problems.length; k++) { var q = problems[(i + k) % problems.length]; if (!isSolved(q.id)) return q; }
    return null;
  }
  function recommended() {
    var best = null;
    problems.forEach(function (p, i) {
      if (isSolved(p.id)) return;
      var key = diffIdx[p.difficulty] * 1000 + i;
      if (!best || key < best.key) best = { p: p, key: key };
    });
    return best ? best.p : null;
  }
  function download(text, filename, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a'); a.href = url; a.download = filename; a.rel = 'noopener'; a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  /* ------------------------------ theme ------------------------------ */
  var THEMES = ['system', 'light', 'dark'];
  var THEME_ICON = { system: 'monitor', light: 'sun', dark: 'moon' };
  function applyTheme() {
    var t = store.get().settings.theme;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  }

  /* ------------------------------ toasts ------------------------------ */
  function toast(title, text, icon) {
    var box = document.getElementById('toasts');
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    var t = el('div', 'toast');
    t.innerHTML = ic(icon || 'star', { size: 18 }) + '<div><b>' + esc(title) + '</b><span>' + esc(text) + '</span></div><button type="button" aria-label="Dismiss notification">' + ic('x', { size: 16 }) + '</button>';
    var timer = null;
    function close() { clearTimeout(timer); if (t.parentNode) t.parentNode.removeChild(t); }
    function arm() { clearTimeout(timer); timer = setTimeout(close, 6500); }
    t.querySelector('button').addEventListener('click', close);
    t.addEventListener('mouseenter', function () { clearTimeout(timer); });
    t.addEventListener('mouseleave', arm);
    t.addEventListener('focusin', function () { clearTimeout(timer); });
    t.addEventListener('focusout', arm);
    box.appendChild(t); arm();
  }

  /* ------------------------------ confirm dialog ------------------------------ */
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      if (typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function') {
        resolve(window.confirm(o.title + '\n\n' + o.body)); return;
      }
      var prev = document.activeElement, value = false;
      var d = el('dialog', 'dlg');
      d.setAttribute('aria-labelledby', 'dlg-t'); d.setAttribute('aria-describedby', 'dlg-d'); d.setAttribute('data-testid', 'confirm-dialog');
      d.innerHTML = '<h2 id="dlg-t">' + esc(o.title) + '</h2><p id="dlg-d">' + esc(o.body) + '</p><div class="actions"><button type="button" class="btn" data-dlg="cancel" autofocus>Cancel</button><button type="button" class="btn btn-primary' + (o.danger ? ' btn-danger' : '') + '" data-dlg="ok" data-testid="confirm-ok">' + esc(o.confirm || 'Confirm') + '</button></div>';
      d.addEventListener('click', function (e) {
        var b = e.target.closest('[data-dlg]');
        if (!b) return;
        value = b.getAttribute('data-dlg') === 'ok'; d.close();
      });
      d.addEventListener('close', function () {
        d.remove();
        if (prev && document.contains(prev) && prev.focus) prev.focus();
        resolve(value);
      });
      document.body.appendChild(d); d.showModal();
    });
  }

  /* ------------------------------ shell: nav and status ------------------------------ */
  var NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'challenges', label: 'Challenges', icon: 'list' },
    { id: 'progress', label: 'Progress', icon: 'chart' },
    { id: 'terminal', label: 'Terminal', icon: 'terminal' },
    { id: 'mentor', label: 'Mentor', icon: 'message' }
  ];
  function buildShell() {
    document.getElementById('nav').innerHTML = NAV.map(function (n) {
      return '<a class="nav-link" href="#/' + n.id + '" data-nav="' + n.id + '" data-testid="nav-' + n.id + '">' + ic(n.icon, { size: 20 }) + '<span>' + n.label + '</span></a>';
    }).join('') + '<p class="nav-foot">Progress stays on this device.</p>';
    document.getElementById('status').innerHTML =
      '<div class="st-level"><b id="st-lvl" data-testid="level-display"></b><span id="st-rank"></span></div>' +
      '<div class="st-xp"><div class="bar" id="st-bar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100"><i></i></div><output id="st-xp" data-testid="xp-display"></output></div>' +
      '<span class="st-streak" id="st-streak" data-testid="streak-display">' + ic('flame', { size: 16 }) + '<span></span></span>' +
      '<span class="st-warn" id="st-warn" hidden>Not saved: storage is blocked</span>' +
      '<button type="button" class="btn icon-btn" id="theme-btn" data-action="theme" data-testid="theme-toggle"></button>';
  }
  function updateStatus() {
    var s = store.get(), st = C.stats(s, problems);
    document.getElementById('st-lvl').textContent = 'Level ' + st.level;
    document.getElementById('st-rank').textContent = st.rank;
    var bar = document.getElementById('st-bar');
    bar.setAttribute('aria-valuenow', st.progress.percent);
    bar.title = st.progress.into + ' of ' + st.progress.needed + ' XP to level ' + (st.level + 1);
    bar.firstChild.style.width = st.progress.percent + '%';
    var o = document.getElementById('st-xp');
    o.textContent = num(st.totalXP) + ' XP';
    var sk = document.getElementById('st-streak');
    sk.lastChild.textContent = st.streak + (st.streak === 1 ? ' day' : ' days');
    sk.title = 'Current streak. Best: ' + st.bestStreak + (st.bestStreak === 1 ? ' day' : ' days');
    document.getElementById('st-warn').hidden = storageOk;
    var t = s.settings.theme, nextT = THEMES[(THEMES.indexOf(t) + 1) % 3];
    var tb = document.getElementById('theme-btn');
    tb.innerHTML = ic(THEME_ICON[t], { size: 18 });
    tb.setAttribute('aria-label', 'Theme: ' + t + '. Switch to ' + nextT);
    tb.title = 'Theme: ' + t;
  }
  function setNav(name) {
    var cur = name === 'challenge' ? 'challenges' : name;
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      if (a.getAttribute('data-nav') === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  /* ------------------------------ router ------------------------------ */
  function parseQuery(q) {
    var o = {};
    q.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
      try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* ignore malformed */ }
    });
    return o;
  }
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), q = '', i = h.indexOf('?');
    if (i >= 0) { q = h.slice(i + 1); h = h.slice(0, i); }
    var parts = h.split('/').filter(Boolean), arg = '';
    try { arg = parts[1] ? decodeURIComponent(parts[1]) : ''; } catch (e) { arg = ''; }
    return { name: parts[0] || '', arg: arg, query: parseQuery(q) };
  }
  var cleanup = null, firstPaint = true, routes;

  function render() {
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    var r = parseHash(), name = r.name;
    if (!has(routes, name) || (name === 'challenge' && !has(byId, r.arg))) {
      name = 'dashboard'; r = { name: name, arg: '', query: {} };
      try { history.replaceState(null, '', '#/dashboard'); } catch (e) { location.hash = '#/dashboard'; }
    }
    view.className = 'view' + (name === 'challenge' ? ' is-ws' : '');
    view.innerHTML = '';
    var out = routes[name](r) || {};
    cleanup = out.cleanup || null;
    document.title = (out.title || 'Dashboard') + ' · Code Arsenal';
    setNav(name);
    if (firstPaint) {
      firstPaint = false;
      view.classList.add('enter');
      view.addEventListener('animationend', function () { view.classList.remove('enter'); }, { once: true });
      if (out.focus) { try { out.focus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    } else {
      var f = out.focus || view.querySelector('h1');
      if (f) { if (!f.hasAttribute('tabindex') && !/^(INPUT|TEXTAREA|BUTTON|A|SELECT)$/.test(f.tagName)) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    }
  }
  function rerender() { var y = window.scrollY; var save = firstPaint; render(); firstPaint = save; window.scrollTo(0, y); }

  /* ------------------------------ dashboard ------------------------------ */
  function heatHTML(s) {
    var counts = {};
    s.xpLog.forEach(function (e) { var k = C.dayKey(e.at); counts[k] = (counts[k] || 0) + 1; });
    var today = new Date(), dow = today.getDay(), start = 11 * 7 + dow, total = 0, cols = '';
    for (var w = 0; w < 12; w++) {
      var cells = '';
      for (var d = 0; d < 7; d++) {
        var off = start - (w * 7 + d);
        if (off < 0) { cells += '<i class="fut"></i>'; continue; }
        var date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - off);
        var n = counts[C.dayKey(date)] || 0; total += n;
        var lvl = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n < 5 ? 3 : 4;
        cells += '<i class="l' + lvl + '" title="' + esc(fmtDate(date) + ': ' + n + (n === 1 ? ' solve' : ' solves')) + '"></i>';
      }
      cols += '<div class="wk">' + cells + '</div>';
    }
    return { total: total, html: '<div class="heat" role="img" aria-label="' + total + ' challenges solved in the last 12 weeks">' + cols + '</div>' +
      '<div class="legend" aria-hidden="true">Fewer <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</div>' };
  }

  function viewDashboard() {
    var s = store.get(), st = C.stats(s, problems), today = C.dayKey(new Date());
    var daily = C.dailyProblem(problems, today);
    var cont = null, kind = 'next';
    if (s.lastOpened && has(byId, s.lastOpened) && !isSolved(s.lastOpened)) { cont = byId[s.lastOpened]; kind = 'resume'; }
    else cont = recommended();
    var fresh = st.solved === 0 && !s.lastOpened;
    var contHTML;
    if (!cont) {
      contHTML = '<div class="cont"><h3>Every challenge is solved</h3><p>You cleared the whole arsenal. Redo a challenge in the other language to keep practising.</p><div class="go"><a class="btn btn-primary" href="#/challenges">Browse challenges</a></div></div>';
    } else {
      var hasDraft = has(s.drafts, cont.id + ':' + s.settings.lang);
      contHTML = '<div class="cont"><h3>' + (fresh ? 'Start with ' : '') + esc(cont.title) + '</h3><p>' + esc(cont.summary) + '</p>' +
        '<div class="meta"><span class="chip">' + esc(catName[cont.category]) + '</span><span class="chip">' + esc(diffLabel[cont.difficulty]) + '</span><span class="chip">' + cont.xp + ' XP</span>' + (hasDraft ? '<span class="chip warn">Draft saved</span>' : '') + '</div>' +
        '<div class="go"><a class="btn btn-primary" data-testid="continue-btn" href="#/challenge/' + esc(cont.id) + '">' + (fresh ? 'Open first challenge' : kind === 'resume' ? 'Continue' : 'Open challenge') + ic('arrow-right', { size: 16 }) + '</a>' +
        '<a class="btn" href="#/challenges">Browse all ' + problems.length + '</a></div></div>';
    }
    var contTitle = fresh ? 'Your first challenge' : kind === 'resume' ? 'Continue' : 'Recommended next';
    var dailySolved = daily && isSolved(daily.id);
    var dailyHTML = daily ? '<div class="cont"><h3>' + esc(daily.title) + '</h3><p>' + esc(daily.summary) + '</p><div class="meta"><span class="chip">' + esc(catName[daily.category]) + '</span><span class="chip">' + esc(diffLabel[daily.difficulty]) + '</span><span class="chip">' + daily.xp + ' XP</span>' + (dailySolved ? '<span class="chip pass">Solved</span>' : '') + '</div><div class="go"><a class="btn" data-testid="daily-btn" href="#/challenge/' + esc(daily.id) + '">' + (dailySolved ? 'Review' : 'Open daily challenge') + '</a></div></div>' : '';
    var lp = st.progress;
    var lvlHTML = '<div class="lvl"><div class="row"><span class="big">Level ' + lp.level + '</span><span class="muted">' + esc(lp.rank) + '</span></div>' + bar(lp.percent, '', 'Progress to level ' + (lp.level + 1)) +
      '<div class="row muted"><span class="num">' + num(lp.into) + ' / ' + num(lp.needed) + ' XP</span><span>' + num(lp.needed - lp.into) + ' to level ' + (lp.level + 1) + '</span></div></div>';
    var kv = '<dl class="kv">' +
      '<dt>Solved</dt><dd>' + st.solved + ' / ' + st.total + '</dd>' +
      '<dt>XP this week</dt><dd data-testid="xp-week">' + num(st.weeklyXP) + '</dd>' +
      '<dt>XP last 30 days</dt><dd>' + num(st.monthlyXP) + '</dd>' +
      '<dt>Success rate</dt><dd>' + (s.submissions ? st.successRate + '%' : 'none yet') + '</dd>' +
      '<dt>Fastest solve</dt><dd>' + (st.fastest === null ? 'none yet' : fmtDur(st.fastest)) + '</dd>' +
      '<dt>Average solve</dt><dd>' + (st.solved ? fmtDur(st.averageSeconds) : 'none yet') + '</dd>' +
      '<dt>Best streak</dt><dd>' + st.bestStreak + (st.bestStreak === 1 ? ' day' : ' days') + '</dd></dl>';
    var mastery = C.CATEGORIES.map(function (c) {
      var pc = st.perCategory[c.id], pct = pc.total ? (pc.solved / pc.total) * 100 : 0;
      return '<li><a href="#/challenges?track=' + esc(c.id) + '">' + esc(c.name) + '</a><span class="n">' + pc.solved + '/' + pc.total + '</span>' +
        bar(pct, 'ink' + (pc.solved === pc.total && pc.total ? ' done' : ''), c.name + ': ' + pc.solved + ' of ' + pc.total + ' solved') + '<span class="n n2">' + num(pc.xp) + ' XP</span></li>';
    }).join('');
    var heat = heatHTML(s);
    var recent = Object.keys(s.solved).map(function (id) { return { id: id, v: s.solved[id] }; }).filter(function (x) { return has(byId, x.id); })
      .sort(function (a, b) { return b.v.at - a.v.at; }).slice(0, 5);
    var recentHTML = recent.length ? '<ul class="recent">' + recent.map(function (x) {
      return '<li><a href="#/challenge/' + esc(x.id) + '">' + esc(byId[x.id].title) + '</a><span class="chip">' + (x.v.lang === 'py' ? 'Python' : 'JavaScript') + '</span><span class="num muted">+' + x.v.xp + ' XP</span><span class="when">' + esc(fmtDate(x.v.at)) + '</span></li>';
    }).join('') + '</ul>' : '<div class="empty"><p>Nothing solved yet. Your solves will be listed here with the XP they earned.</p></div>';

    view.innerHTML = '<div class="page-h"><div><h1 data-heading>Dashboard</h1><p>' + (fresh ? 'Welcome. Pick a challenge, write code, and submit it. XP is awarded when every test passes.' : 'Welcome back, ' + esc(s.name) + '.') + '</p></div></div>' +
      '<div class="dash">' +
      '<section class="panel c-7" aria-labelledby="h-cont"><div class="panel-h"><h2 id="h-cont">' + contTitle + '</h2></div><div class="panel-b">' + contHTML + '</div></section>' +
      '<section class="panel c-5" aria-labelledby="h-daily"><div class="panel-h"><h2 id="h-daily">Daily challenge</h2><span class="muted num">' + esc(today) + '</span></div><div class="panel-b">' + dailyHTML + '</div></section>' +
      '<section class="panel c-7" aria-labelledby="h-mast"><div class="panel-h"><h2 id="h-mast">Track mastery</h2></div><div class="panel-b"><ul class="mastery">' + mastery + '</ul></div></section>' +
      '<section class="panel c-5" aria-labelledby="h-num"><div class="panel-h"><h2 id="h-num">Level and records</h2></div><div class="panel-b">' + lvlHTML + kv + '</div></section>' +
      '<section class="panel c-7" aria-labelledby="h-act"><div class="panel-h"><h2 id="h-act">Activity, last 12 weeks</h2><span class="muted num">' + heat.total + (heat.total === 1 ? ' solve' : ' solves') + '</span></div><div class="panel-b">' + heat.html + '</div></section>' +
      '<section class="panel c-5" aria-labelledby="h-rec"><div class="panel-h"><h2 id="h-rec">Recent solves</h2></div><div class="panel-b">' + recentHTML + '</div></section></div>';
    return { title: 'Dashboard' };
  }

  /* ------------------------------ challenges list ------------------------------ */
  var FILTER_KEY = 'ca.filters';
  var COLS = [
    { k: 'status', label: 'Status', cls: '' }, { k: 'title', label: 'Challenge', cls: '' }, { k: 'track', label: 'Track', cls: 'col-track' },
    { k: 'diff', label: 'Difficulty', cls: '' }, { k: 'xp', label: 'XP', cls: 'r col-xp' }, { k: 'attempts', label: 'Attempts', cls: 'r col-attempts' }
  ];
  function readFilters(q) {
    var f = { q: '', track: '', diff: '', status: '', sort: '', dir: 'asc' };
    var src = q;
    if (!Object.keys(q).length) { try { src = JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') || {}; } catch (e) { src = {}; } }
    if (typeof src.q === 'string') f.q = src.q.slice(0, 80);
    if (has(catName, src.track)) f.track = src.track;
    if (has(diffIdx, src.diff)) f.diff = src.diff;
    if (['solved', 'attempted', 'todo'].indexOf(src.status) >= 0) f.status = src.status;
    if (['status', 'title', 'track', 'diff', 'xp', 'attempts'].indexOf(src.sort) >= 0) { f.sort = src.sort; f.dir = src.dir === 'desc' ? 'desc' : 'asc'; }
    return f;
  }
  function filterQuery(f) {
    var a = [];
    ['q', 'track', 'diff', 'status', 'sort'].forEach(function (k) { if (f[k]) a.push(k + '=' + encodeURIComponent(f[k])); });
    if (f.sort && f.dir === 'desc') a.push('dir=desc');
    return a.join('&');
  }
  function persistFilters(f) {
    var qs = filterQuery(f);
    try { history.replaceState(null, '', '#/challenges' + (qs ? '?' + qs : '')); } catch (e) { /* ignore */ }
    try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch (e) { /* ignore */ }
  }
  function applyFilters(f) {
    var terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    var list = problems.filter(function (p) {
      if (f.track && p.category !== f.track) return false;
      if (f.diff && p.difficulty !== f.diff) return false;
      if (f.status && statusOf(p) !== f.status) return false;
      if (terms.length) {
        var hay = (p.title + ' ' + p.id + ' ' + catName[p.category] + ' ' + p.summary).toLowerCase();
        for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) < 0) return false;
      }
      return true;
    });
    if (f.sort) {
      var s = store.get(), order = { todo: 0, attempted: 1, solved: 2 };
      var key = {
        status: function (p) { return order[statusOf(p)]; }, title: function (p) { return p.title.toLowerCase(); },
        track: function (p) { return catName[p.category]; }, diff: function (p) { return diffIdx[p.difficulty]; },
        xp: function (p) { return p.xp; }, attempts: function (p) { return s.attempts[p.id] || 0; }
      }[f.sort];
      var dir = f.dir === 'desc' ? -1 : 1;
      list = list.map(function (p, i) { return { p: p, i: i, k: key(p) }; }).sort(function (a, b) { return (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i) * dir; }).map(function (x) { return x.p; });
    }
    return list;
  }
  function tableHTML(f, list) {
    var s = store.get();
    if (!list.length) {
      return '<div class="empty" data-testid="empty-results">' + ic('search', { size: 28 }) + '<h2>No challenges match these filters</h2><p>Try a shorter search or remove a filter.</p><button type="button" class="btn" data-action="ch-clear">Clear filters</button></div>';
    }
    var head = COLS.map(function (c) {
      var sorted = f.sort === c.k, ariaSort = sorted ? (f.dir === 'desc' ? 'descending' : 'ascending') : 'none';
      return '<th scope="col" class="' + c.cls + '" aria-sort="' + ariaSort + '"><button type="button" class="sortbtn" data-action="ch-sort" data-k="' + c.k + '" data-testid="sort-' + c.k + '">' + c.label + ic(sorted ? (f.dir === 'desc' ? 'sort-desc' : 'sort-asc') : 'sort', { size: 14 }) + '</button></th>';
    }).join('');
    var rows = list.map(function (p) {
      return '<tr data-testid="problem-' + esc(p.id) + '"><td>' + statusHTML(p) + '</td><td class="t-title"><a href="#/challenge/' + esc(p.id) + '">' + esc(p.title) + '</a><span class="sub">' + esc(catName[p.category]) + '</span></td>' +
        '<td class="col-track">' + esc(catName[p.category]) + '</td><td>' + diffHTML(p) + '</td><td class="num col-xp">' + p.xp + '</td><td class="num col-attempts">' + (s.attempts[p.id] || 0) + '</td></tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="tbl" data-testid="problem-table"><caption class="sr-only">Challenges</caption><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function viewChallenges(r) {
    var f = readFilters(r.query);
    persistFilters(f);
    function opts(list, sel, all) {
      return '<option value="">' + all + '</option>' + list.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === sel ? ' selected' : '') + '>' + esc(o.name || o.label) + '</option>'; }).join('');
    }
    view.innerHTML = '<div class="page-h"><div><h1 data-heading>Challenges</h1><p>Pick one to open the workspace. Press <kbd>/</kbd> to search.</p></div></div>' +
      '<form class="filters" role="search" aria-label="Filter challenges" data-form="noop">' +
      '<div class="field"><label for="f-q">Search</label><div class="input-wrap">' + ic('search', { size: 16 }) + '<input class="input" id="f-q" type="search" data-field="ch-q" data-testid="search" placeholder="Title, track or keyword" autocomplete="off" value="' + esc(f.q) + '"></div></div>' +
      '<div class="field"><label for="f-track">Track</label><select class="select" id="f-track" data-field="ch-track" data-testid="filter-track">' + opts(C.CATEGORIES, f.track, 'All tracks') + '</select></div>' +
      '<div class="field"><label for="f-diff">Difficulty</label><select class="select" id="f-diff" data-field="ch-diff" data-testid="filter-diff">' + opts(C.DIFFICULTIES, f.diff, 'All levels') + '</select></div>' +
      '<div class="field"><label for="f-status">Status</label><select class="select" id="f-status" data-field="ch-status" data-testid="filter-status">' +
      [['', 'Any status'], ['todo', 'Not started'], ['attempted', 'Attempted'], ['solved', 'Solved']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === f.status ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></form>' +
      '<div class="count-line"><span id="ch-count" role="status" data-testid="count"></span><button type="button" class="btn btn-sm btn-ghost" data-action="ch-clear" id="ch-clear">Clear filters</button></div>' +
      '<div id="ch-list"></div>';
    var listEl = document.getElementById('ch-list'), countEl = document.getElementById('ch-count'), clearBtn = document.getElementById('ch-clear');
    function paint(focusSort) {
      var list = applyFilters(f), solved = list.filter(function (p) { return isSolved(p.id); }).length;
      listEl.innerHTML = tableHTML(f, list);
      countEl.textContent = 'Showing ' + list.length + ' of ' + problems.length + ' challenges, ' + solved + ' solved';
      clearBtn.hidden = !(f.q || f.track || f.diff || f.status || f.sort);
      if (focusSort) { var b = listEl.querySelector('[data-k="' + focusSort + '"]'); if (b) b.focus(); }
    }
    paint();
    actions['ch-sort'] = function (t) {
      var k = t.getAttribute('data-k');
      if (f.sort !== k) { f.sort = k; f.dir = 'asc'; } else if (f.dir === 'asc') f.dir = 'desc'; else { f.sort = ''; f.dir = 'asc'; }
      persistFilters(f); paint(k);
    };
    actions['ch-clear'] = function () {
      f = { q: '', track: '', diff: '', status: '', sort: '', dir: 'asc' };
      document.getElementById('f-q').value = ''; document.getElementById('f-track').value = ''; document.getElementById('f-diff').value = ''; document.getElementById('f-status').value = '';
      persistFilters(f); paint(); document.getElementById('f-q').focus();
    };
    fields['ch-q'] = function (v) { f.q = v.slice(0, 80); persistFilters(f); paint(); };
    fields['ch-track'] = function (v) { f.track = has(catName, v) ? v : ''; persistFilters(f); paint(); };
    fields['ch-diff'] = function (v) { f.diff = has(diffIdx, v) ? v : ''; persistFilters(f); paint(); };
    fields['ch-status'] = function (v) { f.status = ['solved', 'attempted', 'todo'].indexOf(v) >= 0 ? v : ''; persistFilters(f); paint(); };
    return { title: 'Challenges' };
  }

  /* ------------------------------ editor wrapper ------------------------------ */
  function createEditor(host, o) {
    var lang = o.lang, silent = false, cm = null, ta = null;
    var unit = function () { return lang === 'py' ? 4 : 2; };
    if (window.CodeMirror) {
      cm = window.CodeMirror(host, {
        value: o.value, mode: lang === 'py' ? 'python' : 'javascript', theme: 'arsenal', lineNumbers: true,
        indentUnit: unit(), tabSize: unit(), indentWithTabs: false, smartIndent: true, autoCloseBrackets: true, matchBrackets: true, lineWrapping: false,
        extraKeys: {
          'Ctrl-Enter': function () { o.onRun(); }, 'Cmd-Enter': function () { o.onRun(); },
          'Shift-Ctrl-Enter': function () { o.onSubmit(); }, 'Shift-Cmd-Enter': function () { o.onSubmit(); },
          Tab: function (c) { if (c.somethingSelected()) c.indentSelection('add'); else c.execCommand('insertSoftTab'); },
          'Shift-Tab': function (c) { c.indentSelection('subtract'); },
          'Ctrl-/': function (c) { c.execCommand('toggleComment'); }, 'Cmd-/': function (c) { c.execCommand('toggleComment'); },
          Esc: function () { o.onEscape(); }
        }
      });
      cm.getInputField().setAttribute('aria-label', 'Code editor');
      cm.getInputField().setAttribute('data-testid', 'editor-input');
      cm.on('change', function () { if (!silent) o.onChange(); });
      return {
        kind: 'cm', get: function () { return cm.getValue(); },
        set: function (v, l) { silent = true; lang = l; cm.setOption('mode', l === 'py' ? 'python' : 'javascript'); cm.setOption('indentUnit', unit()); cm.setOption('tabSize', unit()); cm.setValue(v); cm.clearHistory(); silent = false; },
        focus: function () { cm.focus(); }, refresh: function () { cm.refresh(); }, destroy: function () { host.innerHTML = ''; }
      };
    }
    ta = el('textarea', 'fallback');
    ta.value = o.value; ta.spellcheck = false; ta.setAttribute('aria-label', 'Code editor'); ta.setAttribute('data-testid', 'editor-input');
    ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off');
    ta.addEventListener('input', function () { if (!silent) o.onChange(); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        var pad = ' '.repeat(unit()), st = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, st) + pad + ta.value.slice(en); ta.selectionStart = ta.selectionEnd = st + pad.length; o.onChange();
      } else if (e.key === 'Escape') { o.onEscape(); }
    });
    host.appendChild(ta);
    return {
      kind: 'textarea', get: function () { return ta.value; }, set: function (v, l) { silent = true; lang = l; ta.value = v; silent = false; },
      focus: function () { ta.focus(); }, refresh: function () {}, destroy: function () { host.innerHTML = ''; }
    };
  }

  /* ------------------------------ workspace ------------------------------ */
  function jsonStr(v) { var s; try { s = JSON.stringify(v); } catch (e) { s = String(v); } if (s === undefined) s = 'undefined'; return s.length > 2000 ? s.slice(0, 2000) + '…' : s; }
  function argsStr(p, lang, args) {
    var names = lang === 'py' ? p.pyParams : p.params;
    if (!Array.isArray(args)) return jsonStr(args);
    return args.map(function (a, i) { return (names[i] || 'arg' + (i + 1)) + ' = ' + jsonStr(a); }).join(', ');
  }
  function openProblem(p) {
    var now = Date.now();
    if (!sessionOpened[p.id]) sessionOpened[p.id] = now;
    lastWsId = p.id;
    store.update(function (s) { s.lastOpened = p.id; if (!s.opened[p.id]) s.opened[p.id] = now; });
  }

  function viewChallenge(r) {
    var p = byId[r.arg];
    openProblem(p);
    var ws = { p: p, lang: store.get().settings.lang === 'py' ? 'py' : 'js', editor: null, busy: false, token: 0, tab: 'desc', mounted: true, dirty: false, timer: null };
    var langName = C.LANG_NAMES;
    var solvedNow = isSolved(p.id);

    view.innerHTML = '<div class="ws" id="ws" data-pane="problem">' +
      '<div class="ws-head"><a class="back" href="#/challenges">' + ic('arrow-left', { size: 16 }) + 'Challenges</a><h1 data-heading tabindex="-1">' + esc(p.title) + '</h1>' +
      '<div class="chips"><span class="chip">' + esc(catName[p.category]) + '</span><span class="chip">' + esc(diffLabel[p.difficulty]) + '</span><span class="chip">' + p.xp + ' XP</span><span id="ws-solved"></span></div></div>' +
      '<div class="seg paneswitch" role="group" aria-label="Show"><button type="button" data-action="pane" data-v="problem" aria-pressed="true">Problem</button><button type="button" data-action="pane" data-v="code" aria-pressed="false" data-testid="pane-code">Code</button></div>' +
      '<div class="ws-grid"><section class="pane pane-problem" aria-label="Problem">' +
      '<div class="tabs" role="tablist" aria-label="Problem sections" data-testid="tabs">' +
      [['desc', 'Description', 'book'], ['hints', 'Hints', 'lightbulb'], ['notes', 'Solution notes', 'lock']].map(function (t, i) {
        return '<button type="button" class="tab" role="tab" id="tab-' + t[0] + '" data-action="tab" data-v="' + t[0] + '" data-testid="tab-' + t[0] + '" aria-controls="tabpanel" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + ic(t[2], { size: 16 }) + t[1] + '</button>';
      }).join('') + '</div><div class="tabpanel" id="tabpanel" role="tabpanel" aria-labelledby="tab-desc" tabindex="0"></div></section>' +
      '<section class="pane pane-work work" aria-label="Code and results"><div class="work-bar">' +
      '<div class="seg" role="group" aria-label="Language">' + C.LANGS.map(function (l) { return '<button type="button" data-action="lang" data-v="' + l + '" data-testid="lang-' + l + '" aria-pressed="' + (l === ws.lang) + '">' + langName[l] + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-action="reset-code" data-testid="reset-code">' + ic('reset', { size: 14 }) + 'Reset</button><span class="spacer"></span>' +
      '<button type="button" class="btn" data-action="run" title="Run visible tests (Ctrl+Enter)" data-testid="run-btn" id="run-btn">' + ic('play', { size: 14 }) + 'Run</button>' +
      '<button type="button" class="btn btn-primary" data-action="submit" title="Submit all tests (Ctrl+Shift+Enter)" data-testid="submit-btn" id="submit-btn">' + ic('check', { size: 14 }) + 'Submit</button></div>' +
      '<div class="ed" id="ed" data-testid="editor"></div>' +
      '<div class="results" id="results" data-testid="results" role="region" aria-label="Results" tabindex="0"></div></section></div></div>';

    var wsEl = document.getElementById('ws'), panel = document.getElementById('tabpanel'), results = document.getElementById('results');
    var runBtn = document.getElementById('run-btn'), submitBtn = document.getElementById('submit-btn');

    function draftKey() { return p.id + ':' + ws.lang; }
    function loadCode() { var d = store.get().drafts[draftKey()]; return typeof d === 'string' ? d : p.starter[ws.lang]; }
    function saveDraft() {
      clearTimeout(ws.timer); ws.timer = null;
      if (!ws.dirty || !ws.editor) return;
      ws.dirty = false;
      var code = ws.editor.get(), key = draftKey();
      store.update(function (s) {
        if (code === p.starter[ws.lang] || code === '') delete s.drafts[key];
        else if (code.length <= C.MAX_CODE_LENGTH) s.drafts[key] = code;
      });
    }
    function onChange() { ws.dirty = true; clearTimeout(ws.timer); ws.timer = setTimeout(saveDraft, 600); }

    function solvedChip() { document.getElementById('ws-solved').innerHTML = isSolved(p.id) ? '<span class="chip pass">' + ic('check-circle', { size: 14 }) + 'Solved</span>' : ''; }

    /* left pane */
    function descHTML() {
      var h = '<div class="prose">' + p.statement.map(function (t) { return '<p>' + C.fmt(t) + '</p>'; }).join('');
      h += '<h2>Examples</h2>' + p.examples.map(function (e) {
        return '<div class="ex"><div><span class="k">Input </span>' + esc(e.input) + '</div><div><span class="k">Output </span>' + esc(e.output) + '</div>' + (e.note ? '<div class="note">' + esc(e.note) + '</div>' : '') + '</div>';
      }).join('');
      h += '<h2>Constraints</h2><ul class="cons">' + p.constraints.map(function (c) { return '<li>' + C.fmt(c) + '</li>'; }).join('') + '</ul>';
      return h + '<p class="muted" style="margin-top:16px">Write <code>' + esc(ws.lang === 'py' ? p.pyFn : p.fn) + '(' + esc((ws.lang === 'py' ? p.pyParams : p.params).join(', ')) + ')</code>. Return a value; do not print it.</p></div>';
    }
    function hintsHTML() {
      var n = hintsShown[p.id] || 0, total = p.hints.length, h = '<div class="prose"><p class="muted">Hints are optional and shown one at a time, from a nudge to a near-answer.</p><div style="margin-top:12px">';
      for (var i = 0; i < n; i++) h += '<div class="hint-item"><b>Hint ' + (i + 1) + ' of ' + total + '</b>' + C.fmt(p.hints[i]) + '</div>';
      if (n < total) h += '<button type="button" class="btn" data-action="hint" data-testid="reveal-hint">' + ic('lightbulb', { size: 16 }) + 'Reveal hint ' + (n + 1) + ' of ' + total + '</button>';
      else h += '<p class="muted">No more hints. Try your approach on a small example by hand.</p>';
      return h + '</div></div>';
    }
    function notesHTML() {
      if (!isSolved(p.id)) return '<div class="locked-note">' + ic('lock', { size: 18 }) + '<div><strong>Locked until you solve this challenge.</strong><p>The editorial and reference solution appear here after a submission passes every test. Use the hints if you are stuck.</p></div></div>';
      return '<div class="prose"><p><strong>Complexity:</strong> ' + esc(p.complexity) + '</p><h2>Editorial</h2><p>' + C.fmt(p.editorial) + '</p><h2>Reference solution (' + esc(langName[ws.lang]) + ')</h2><pre class="code" tabindex="0"><code>' + esc(p.solutions[ws.lang]) + '</code></pre></div>';
    }
    function paintTab() {
      panel.setAttribute('aria-labelledby', 'tab-' + ws.tab);
      panel.innerHTML = ws.tab === 'desc' ? descHTML() : ws.tab === 'hints' ? hintsHTML() : notesHTML();
      Array.prototype.forEach.call(wsEl.querySelectorAll('.tab'), function (t) {
        var on = t.getAttribute('data-v') === ws.tab;
        t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      });
      var nt = document.getElementById('tab-notes');
      nt.innerHTML = ic(isSolved(p.id) ? 'book' : 'lock', { size: 16 }) + 'Solution notes';
    }
    actions.tab = function (t) { ws.tab = t.getAttribute('data-v'); paintTab(); };
    actions.hint = function () { hintsShown[p.id] = Math.min(p.hints.length, (hintsShown[p.id] || 0) + 1); paintTab(); var b = panel.querySelector('[data-action="hint"]'); (b || panel).focus(); };
    actions.pane = function (t) {
      var v = t.getAttribute('data-v'); wsEl.setAttribute('data-pane', v);
      Array.prototype.forEach.call(wsEl.querySelectorAll('.paneswitch button'), function (b) { b.setAttribute('aria-pressed', b === t); });
      if (ws.editor) ws.editor.refresh();
    };
    keyHandlers.tablist = function (e, t) {
      var order = ['desc', 'hints', 'notes'], i = order.indexOf(ws.tab);
      if (e.key === 'ArrowRight') i = (i + 1) % 3; else if (e.key === 'ArrowLeft') i = (i + 2) % 3; else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = 2; else return;
      e.preventDefault(); ws.tab = order[i]; paintTab(); document.getElementById('tab-' + ws.tab).focus();
    };

    /* run and submit */
    function setBusy(b) {
      ws.busy = b;
      [runBtn, submitBtn].forEach(function (x) { x.disabled = b; x.setAttribute('aria-busy', String(b)); });
      Array.prototype.forEach.call(wsEl.querySelectorAll('[data-action="lang"],[data-action="reset-code"]'), function (x) { x.disabled = b; });
      results.setAttribute('aria-busy', String(b));
    }
    function emptyResults() {
      results.innerHTML = '<div class="empty-res"><p><strong>No results yet.</strong></p><p><strong>Run</strong> checks your code against the ' + p.tests.filter(function (t) { return !t.hidden; }).length + ' visible tests and never changes your progress.</p><p><strong>Submit</strong> judges all ' + p.tests.length + ' tests, including hidden ones. Only a fully passing submission earns XP.</p><p class="muted"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> submits, <kbd>Esc</kbd> leaves the editor.</p></div>';
    }
    function loadingHTML(msg) { return '<div class="loading" role="status"><span class="spin" aria-hidden="true"></span><span id="load-msg">' + esc(msg) + '</span></div>'; }

    function testsHTML(res, lang) {
      return '<ul class="tests" data-testid="test-list">' + res.results.map(function (t) {
        var n = t.index + 1, ms = (t.ms || 0) + ' ms';
        var pf = t.passed ? '<span class="pf pass">' + ic('check-circle', { size: 16 }) + 'Passed</span>' : '<span class="pf fail">' + ic('x', { size: 16 }) + 'Failed</span>';
        if (t.hidden) {
          return '<li data-testid="test-row" data-passed="' + t.passed + '"><div class="row-static">' + pf + '<span>Hidden test ' + n + '</span><span class="ms">' + esc(ms) + '</span></div>' + (t.error ? '<dl><dt>Error</dt><dd class="bad">' + esc(t.error) + '</dd></dl>' : '') + '</li>';
        }
        var d = '<dl><dt>Input</dt><dd>' + esc(argsStr(p, lang, t.input)) + '</dd><dt>Expected</dt><dd>' + esc(jsonStr(t.expected)) + '</dd>' +
          (t.error ? '<dt>Error</dt><dd class="bad">' + esc(t.error) + '</dd>' : '<dt>Actual</dt><dd' + (t.passed ? '' : ' class="bad"') + '>' + esc(jsonStr(t.actual)) + '</dd>') + '</dl>';
        return '<li data-testid="test-row" data-passed="' + t.passed + '"><details' + (t.passed ? '' : ' open') + '><summary>' + pf + '<span>Test ' + n + '</span><span class="ms">' + esc(ms) + '</span>' + ic('chevron-right', { size: 14 }).replace('class="ic"', 'class="ic chev"') + '</summary>' + d + '</details></li>';
      }).join('') + '</ul>';
    }
    function solveBoxHTML(rec) {
      var a = rec.awarded, h = '<div class="solved-box" data-testid="solve-box"><h3>' + ic('check-circle', { size: 18 }) + (a ? 'Solved. XP awarded.' : 'All tests passed.') + '</h3>';
      if (a) {
        h += '<dl class="xp-lines" data-testid="xp-breakdown"><dt>Base (' + esc(diffLabel[p.difficulty]) + ')</dt><dd>+' + a.base + '</dd>';
        if (a.speed) h += '<dt>Speed bonus</dt><dd>+' + a.speed + '</dd>';
        if (a.attempts) h += '<dt>Earlier failed attempts</dt><dd>' + String(a.attempts).replace('-', '−') + '</dd>';
        if (a.streak) h += '<dt>Streak bonus</dt><dd>+' + a.streak + '</dd>';
        h += '<dt class="total">Total</dt><dd class="total" data-testid="xp-awarded">+' + a.total + ' XP</dd></dl>';
      } else h += '<p>You already solved this one, so there is no extra XP for repeat solves.</p>';
      var extra = '';
      if (rec.leveledUp) extra += '<li>' + ic('trending', { size: 16 }) + 'Level up: you are now level ' + rec.level + ', ' + esc(C.rankForLevel(rec.level)) + '.</li>';
      rec.newAchievements.forEach(function (x) { extra += '<li>' + ic(x.icon, { size: 16 }) + 'Achievement: ' + esc(x.name) + '</li>'; });
      if (extra) h += '<ul>' + extra + '</ul>';
      var nx = nextUnsolved(p);
      h += '<div class="next">' + (nx ? '<a class="btn btn-primary" data-testid="next-problem" href="#/challenge/' + esc(nx.id) + '">Next: ' + esc(nx.title) + ic('arrow-right', { size: 16 }) + '</a>' : '<span>Every challenge is solved.</span>') + '<a class="btn" href="#/challenges">All challenges</a></div></div>';
      return h;
    }
    function consoleHTML(res) {
      return res.logs && res.logs.length ? '<div class="console"><h2>Console output</h2><pre data-testid="console">' + esc(res.logs.join('\n')) + '</pre></div>' : '';
    }
    function resultHTML(res, mode, rec, lang) {
      var h = '';
      if (res.status === 'unavailable') {
        h = '<div class="alert warn" data-testid="result-error">' + ic('alert', { size: 18 }) + '<div><strong>The code runner is not available</strong>' + esc(res.message || 'The sandbox could not start. Check your connection (Python needs to download its runtime) and try again.') + '</div></div>';
      } else if (res.status === 'compile_error') {
        h = '<div class="alert" data-testid="result-error">' + ic('alert', { size: 18 }) + '<div><strong>Compile error</strong>Your code could not be parsed.<pre>' + esc(res.message) + '</pre></div></div>';
      } else if (res.status === 'error') {
        h = '<div class="alert" data-testid="result-error">' + ic('alert', { size: 18 }) + '<div><strong>Runtime error</strong><pre>' + esc(res.message) + '</pre></div></div>';
      } else if (res.status === 'timeout') {
        h = '<div class="alert" data-testid="result-error">' + ic('alert', { size: 18 }) + '<div><strong>Time limit exceeded</strong>' + esc(res.message || 'Your code ran for too long and was stopped. Look for an infinite loop or an approach that is too slow.') + '</div></div>';
      } else {
        var ok = res.allPassed, label = mode === 'run' ? 'visible test' + (res.total === 1 ? '' : 's') : 'test' + (res.total === 1 ? '' : 's');
        h = '<div class="res-sum"><h2 data-testid="result-summary">' + res.passedCount + ' of ' + res.total + ' ' + label + ' passed</h2><span class="chip ' + (ok ? 'pass' : 'fail') + '">' + (ok ? 'All passed' : 'Not yet') + '</span><span class="meta">' + (mode === 'run' ? 'Run only. Progress is unchanged.' : 'Submission') + '</span></div>';
        if (mode === 'submit' && ok && rec) h += solveBoxHTML(rec);
        else if (mode === 'submit' && !ok) h += '<div class="alert info" style="margin-bottom:12px">' + ic('info', { size: 18 }) + '<div>Submission not accepted. The attempt was recorded; fix the failing tests and submit again.</div></div>';
        else if (mode === 'run' && ok) h += '<div class="alert info" style="margin-bottom:12px">' + ic('info', { size: 18 }) + '<div>Visible tests pass. Submit to judge the hidden tests and earn XP.</div></div>';
        h += testsHTML(res, lang);
      }
      return h + consoleHTML(res);
    }
    function summaryText(res, mode, rec) {
      if (res.status !== 'done') return 'Run failed: ' + (res.status === 'timeout' ? 'time limit exceeded' : res.status.replace('_', ' ')) + '.';
      var t = res.passedCount + ' of ' + res.total + (mode === 'run' ? ' visible' : '') + ' tests passed.';
      if (mode === 'submit' && res.allPassed) t += rec && rec.awarded ? ' Solved. ' + rec.awarded.total + ' XP awarded.' : ' Already solved, no extra XP.';
      return t;
    }
    function recordSubmission(res, lang) {
      var s0 = store.get(), passed = res.status === 'done' && res.allPassed === true;
      var seconds = Math.min(86400, Math.max(1, Math.round((Date.now() - (sessionOpened[p.id] || Date.now())) / 1000)));
      var rec = C.applySubmission(s0, problems, { id: p.id, passed: passed, lang: lang, seconds: seconds, now: Date.now() });
      store.set(rec.state);
      if (rec.leveledUp) toast('Level up', 'You reached level ' + rec.level + ', ' + C.rankForLevel(rec.level) + '.', 'trending');
      if (rec.newAchievements.length === 1) toast('Achievement unlocked', rec.newAchievements[0].name + ': ' + rec.newAchievements[0].desc, rec.newAchievements[0].icon);
      else if (rec.newAchievements.length > 1) toast(rec.newAchievements.length + ' achievements unlocked', rec.newAchievements.map(function (a) { return a.name; }).join(', '), 'star');
      return rec;
    }

    function execute(mode) {
      if (ws.busy || !ws.mounted) return;
      saveDraft();
      var lang = ws.lang, code = ws.editor.get();
      if (!window.CARunner || typeof window.CARunner.run !== 'function') {
        results.innerHTML = '<div class="alert warn" data-testid="result-error">' + ic('alert', { size: 18 }) + '<div><strong>The code runner failed to load</strong>Reload the page. If it keeps happening, check that js/runner.js is reachable.</div></div>';
        return;
      }
      setBusy(true); var token = ++ws.token;
      results.innerHTML = loadingHTML(mode === 'submit' ? 'Submitting…' : 'Running visible tests…');
      announce(mode === 'submit' ? 'Submitting.' : 'Running tests.');
      function done(res) {
        var rec = null;
        if (mode === 'submit' && ['done', 'compile_error', 'error', 'timeout'].indexOf(res.status) >= 0) rec = recordSubmission(res, lang);
        if (!ws.mounted || token !== ws.token) return;
        setBusy(false);
        results.innerHTML = resultHTML(res, mode, rec, lang);
        results.setAttribute('data-status', res.status);
        results.setAttribute('data-all-passed', String(res.allPassed === true));
        announce(summaryText(res, mode, rec));
        solvedChip(); if (ws.tab === 'notes') paintTab();
      }
      var promise;
      try {
        promise = window.CARunner.run({ lang: lang, code: code, problem: p, mode: mode, onStatus: function (m) {
          var n = document.getElementById('load-msg'); if (n && ws.mounted && token === ws.token) n.textContent = String(m);
        } });
      } catch (e) { promise = Promise.reject(e); }
      Promise.resolve(promise).then(done, function (err) {
        done({ status: 'unavailable', message: 'The runner failed: ' + (err && err.message ? err.message : 'unknown error'), logs: [], results: [], passedCount: 0, total: 0, allPassed: false });
      });
    }
    actions.run = function () { execute('run'); };
    actions.submit = function () { execute('submit'); };
    actions.lang = function (t) {
      var l = t.getAttribute('data-v');
      if (ws.busy || l === ws.lang || C.LANGS.indexOf(l) < 0) return;
      saveDraft(); ws.lang = l;
      store.update(function (s) { s.settings.lang = l; });
      Array.prototype.forEach.call(wsEl.querySelectorAll('[data-action="lang"]'), function (b) { b.setAttribute('aria-pressed', b === t); });
      ws.editor.set(loadCode(), l); emptyResults(); if (ws.tab !== 'hints') paintTab(); ws.editor.focus();
    };
    actions['reset-code'] = function () {
      if (ws.busy) return;
      confirmDialog({ title: 'Reset to starter code?', body: 'Your current ' + langName[ws.lang] + ' code for this challenge will be replaced with the starter template. This cannot be undone.', confirm: 'Reset code', danger: true }).then(function (ok) {
        if (!ok || !ws.mounted) return;
        store.update(function (s) { delete s.drafts[draftKey()]; });
        ws.dirty = false; ws.editor.set(p.starter[ws.lang], ws.lang); ws.editor.focus(); announce('Code reset to the starter template.');
      });
    };
    shortcuts.ws = function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter' || e.defaultPrevented) return false;
      e.preventDefault(); execute(e.shiftKey ? 'submit' : 'run'); return true;
    };

    paintTab(); solvedChip(); emptyResults();
    ws.editor = createEditor(document.getElementById('ed'), {
      value: loadCode(), lang: ws.lang, onChange: onChange,
      onRun: function () { execute('run'); }, onSubmit: function () { execute('submit'); },
      onEscape: function () { runBtn.focus(); }
    });
    var edHint = el('p', 'ed-hint'); edHint.textContent = '';
    setTimeout(function () { if (ws.editor) ws.editor.refresh(); }, 0);
    window.addEventListener('pagehide', saveDraft);
    return {
      title: p.title,
      cleanup: function () { saveDraft(); ws.mounted = false; window.removeEventListener('pagehide', saveDraft); delete shortcuts.ws; delete keyHandlers.tablist; }
    };
  }

  /* ------------------------------ progress ------------------------------ */
  function viewProgress() {
    var s = store.get(), st = C.stats(s, problems);
    var ach = C.ACHIEVEMENTS.map(function (a) {
      var at = s.achievements[a.id], got = !!at;
      return '<li class="' + (got ? 'earned' : 'locked') + '" data-testid="ach-' + a.id + '"><span class="ico">' + ic(got ? a.icon : 'lock', { size: 18 }) + '</span><div><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + '</small><small>' + (got ? 'Earned ' + esc(fmtDate(at)) : 'Locked') + '</small></div></li>';
    }).join('');
    var earned = Object.keys(s.achievements).length;
    var ladder = C.RANKS.map(function (r, i) {
      var next = C.RANKS[i + 1], here = st.level >= r.level && (!next || st.level < next.level), reached = st.level >= r.level;
      return '<li class="' + (here ? 'here' : reached ? 'reached' : '') + '"' + (here ? ' aria-current="step"' : '') + '><span class="dot"></span><span><b>' + esc(r.name) + '</b>' + (here ? ' <span class="chip">You are here</span>' : '') + '</span><span class="lv">Level ' + r.level + (reached && !here ? ', reached' : '') + '</span></li>';
    }).join('');
    var tracks = C.CATEGORIES.map(function (c) {
      var pc = st.perCategory[c.id], pct = pc.total ? Math.round(pc.solved / pc.total * 100) : 0;
      return '<tr><th scope="row" style="padding:10px 12px;font-weight:500;background:none;border-bottom:0;color:inherit"><a href="#/challenges?track=' + esc(c.id) + '">' + esc(c.name) + '</a></th><td class="num">' + pc.solved + '/' + pc.total + '</td><td class="num">' + num(pc.xp) + '</td><td class="c-bar" style="min-width:90px">' + bar(pct, 'ink' + (pct === 100 ? ' done' : ''), c.name + ' ' + pct + '% complete') + '</td></tr>';
    }).join('');
    view.innerHTML = '<div class="page-h"><div><h1 data-heading>Progress</h1><p>Level ' + st.level + ', ' + esc(st.rank) + '. ' + num(st.totalXP) + ' XP, ' + st.solved + ' of ' + st.total + ' challenges solved.</p></div></div>' +
      '<div class="prog">' +
      '<section class="panel c-7" aria-labelledby="h-ach"><div class="panel-h"><h2 id="h-ach">Achievements</h2><span class="muted num">' + earned + ' of ' + C.ACHIEVEMENTS.length + ' earned</span></div><div class="panel-b"><ul class="ach">' + ach + '</ul></div></section>' +
      '<section class="panel c-5" aria-labelledby="h-rank"><div class="panel-h"><h2 id="h-rank">Rank ladder</h2><span class="muted">Your own ladder, not a global board</span></div><div class="panel-b"><ol class="ladder">' + ladder + '</ol></div></section>' +
      '<section class="panel c-7" aria-labelledby="h-tr"><div class="panel-h"><h2 id="h-tr">By track</h2></div><div class="panel-b"><table class="tbl" style="width:100%"><thead><tr><th scope="col"><span class="plain">Track</span></th><th scope="col" class="r"><span class="plain" style="text-align:right">Solved</span></th><th scope="col" class="r"><span class="plain" style="text-align:right">XP</span></th><th scope="col" class="c-bar"><span class="plain">Complete</span></th></tr></thead><tbody>' + tracks + '</tbody></table></div></section>' +
      '<section class="panel c-5" aria-labelledby="h-data"><div class="panel-h"><h2 id="h-data">Your data</h2></div><div class="panel-b data-actions">' +
      '<p>Progress lives only in this browser. Export a backup to move it to another device, or import one to restore it.</p>' +
      '<div class="row"><button type="button" class="btn" data-action="export" data-testid="export-btn">' + ic('download', { size: 16 }) + 'Export backup</button>' +
      '<span><input type="file" id="imp" class="file-input" accept="application/json,.json" data-field="import-file" data-testid="import-input"><label class="btn" for="imp">' + ic('upload', { size: 16 }) + 'Import backup</label></span></div>' +
      '<p class="msg" id="data-msg" role="status" data-testid="data-msg"></p>' +
      '<div><button type="button" class="btn btn-danger" data-action="reset-all" data-testid="reset-all">' + ic('trash', { size: 16 }) + 'Reset all progress</button></div></div></section></div>';
    function msg(text, cls) { var m = document.getElementById('data-msg'); if (m) { m.textContent = text; m.className = 'msg ' + (cls || ''); } }
    actions.export = function () { download(store.exportJSON(), 'code-arsenal-backup-' + C.dayKey(new Date()) + '.json'); msg('Backup downloaded.', 'ok'); };
    actions['reset-all'] = function () {
      confirmDialog({ title: 'Reset all progress?', body: 'This permanently erases your XP, solves, achievements, streak and saved drafts on this device. Export a backup first if you might want them back.', confirm: 'Erase everything', danger: true }).then(function (ok) {
        if (!ok) return;
        store.reset(); sessionOpened = {}; hintsShown = {}; lastWsId = ''; chatLog = []; mentorState = {}; rerender(); announce('All progress was reset.');
      });
    };
    fields['import-file'] = function (v, input) {
      var file = input.files && input.files[0]; if (!file) return;
      if (file.size > 5e6) { msg('That file is larger than 5 MB, so it cannot be a backup.', 'err'); input.value = ''; return; }
      var read = file.text ? file.text() : new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result)); }; fr.onerror = rej; fr.readAsText(file); });
      read.then(function (text) {
        var chk = C.sanitizeState(safeParse(text), problems);
        if (!chk) { msg('That file is not a Code Arsenal backup.', 'err'); return; }
        return confirmDialog({ title: 'Replace your progress with this backup?', body: 'Importing overwrites the progress currently stored in this browser.', confirm: 'Import backup', danger: true }).then(function (ok) {
          if (!ok) return;
          var r = store.importJSON(text);
          if (r.ok) { rerender(); var m2 = document.getElementById('data-msg'); if (m2) { m2.textContent = 'Backup imported.'; m2.className = 'msg ok'; } announce('Backup imported.'); } else msg(r.error, 'err');
        });
      }, function () { msg('The file could not be read.', 'err'); }).then(function () { input.value = ''; });
    };
    return { title: 'Progress' };
  }
  function safeParse(t) { try { return JSON.parse(t); } catch (e) { return null; } }

  /* ------------------------------ terminal ------------------------------ */
  function getTerm() {
    if (!term && window.CATerminal) term = window.CATerminal.create({ problems: problems, store: store, core: C });
    return term;
  }
  function viewTerminal() {
    var t = getTerm();
    view.innerHTML = '<div class="page-h"><div><h1 data-heading>Terminal</h1><p>Commands run against your real progress. Type <code>help</code> to list them.</p></div></div>' +
      '<div class="term" data-testid="terminal"><div class="term-out" id="tout" role="log" aria-label="Terminal output"></div>' +
      '<form class="term-in" data-form="term" autocomplete="off"><label for="tin">arsenal $</label><input id="tin" type="text" data-testid="terminal-input" aria-label="Terminal command" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="500"></form></div>' +
      '<p class="term-tip">Tab completes, Up and Down browse history, Ctrl+L clears.</p>';
    var out = document.getElementById('tout'), input = document.getElementById('tin'), histPos = -1, draft = '';
    function addLine(l) {
      var d = el('div', 'ln ' + String(l.kind || 'out').replace(/[^a-z]/g, '')); d.textContent = l.text; out.appendChild(d);
    }
    function push(l) { termLog.push(l); if (termLog.length > 500) termLog.shift(); addLine(l); }
    if (!t) { push({ text: 'The terminal module failed to load. Reload the page.', kind: 'err' }); input.disabled = true; }
    else if (!termWelcomed) { termWelcomed = true; termLog.push({ text: 'Code Arsenal terminal. Type help for commands.', kind: 'dim' }); }
    termLog.forEach(addLine);
    function scroll() { out.scrollTop = out.scrollHeight; }
    scroll();
    forms.term = function () {
      var line = input.value; input.value = ''; histPos = -1;
      push({ text: 'arsenal $ ' + line, kind: 'cmd' });
      if (line.trim()) { if (inputHist[inputHist.length - 1] !== line) inputHist.push(line); if (inputHist.length > 100) inputHist.shift(); }
      if (!t) return;
      var res = t.exec(line);
      if (res.clear) { termLog = []; out.innerHTML = ''; }
      (res.lines || []).forEach(push);
      if (res.theme) { applyTheme(); updateStatus(); }
      if (typeof res.download === 'string') download(res.download, 'code-arsenal-backup-' + C.dayKey(new Date()) + '.json');
      scroll();
      if (typeof res.navigate === 'string' && /^#\/(dashboard|challenges|challenge\/[a-z0-9-]+|progress|terminal|mentor)$/.test(res.navigate)) { location.hash = res.navigate; }
    };
    keyHandlers.term = function (e) {
      if (e.key === 'ArrowUp') {
        if (!inputHist.length) return; e.preventDefault();
        if (histPos === -1) { draft = input.value; histPos = inputHist.length; }
        histPos = Math.max(0, histPos - 1); input.value = inputHist[histPos];
      } else if (e.key === 'ArrowDown') {
        if (histPos === -1) return; e.preventDefault();
        histPos++; if (histPos >= inputHist.length) { histPos = -1; input.value = draft; } else input.value = inputHist[histPos];
      } else if (e.key === 'Tab' && !e.shiftKey && t) {
        e.preventDefault();
        var m = t.complete(input.value) || [];
        if (!m.length) return;
        if (m.length === 1) { input.value = m[0] + (/\s/.test(m[0]) ? '' : ' '); return; }
        var pre = m[0]; m.forEach(function (x) { while (x.indexOf(pre) !== 0) pre = pre.slice(0, -1); });
        if (pre.length > input.value.replace(/^\s+/, '').length) input.value = pre;
        else { push({ text: m.join('   '), kind: 'dim' }); scroll(); }
      } else if (e.key.toLowerCase() === 'l' && e.ctrlKey) {
        e.preventDefault(); termLog = []; out.innerHTML = '';
      }
    };
    actions['term-focus'] = function () { if (!String(window.getSelection())) input.focus(); };
    out.setAttribute('data-action', 'term-focus');
    return { title: 'Terminal', focus: input, cleanup: function () { delete keyHandlers.term; delete forms.term; } };
  }

  /* ------------------------------ mentor ------------------------------ */
  function mentorCtx() {
    var p = mentorCtxOn && lastWsId && has(byId, lastWsId) ? byId[lastWsId] : null, s = store.get(), lang = s.settings.lang === 'py' ? 'py' : 'js';
    var ctx = { problems: problems, stats: C.stats(s, problems), solvedIds: Object.keys(s.solved), lang: lang, problem: null, code: '', solved: false };
    if (p) { ctx.problem = p; ctx.solved = isSolved(p.id); ctx.code = typeof s.drafts[p.id + ':' + lang] === 'string' ? s.drafts[p.id + ':' + lang] : ''; }
    return ctx;
  }
  function viewMentor() {
    var M = window.CAMentor;
    var prompts = ['Give me a hint', 'Review my code', 'What should I practise next?', 'Explain big-O', 'Explain hash maps'];
    view.innerHTML = '<div class="page-h"><div><h1 data-heading>Mentor</h1><p>Offline tutor (rule-based, runs in your browser). It matches keywords against fixed topics; it is not an AI model and sends nothing anywhere.</p></div></div>' +
      '<div class="chat" data-testid="mentor"><div class="chat-ctx" id="chat-ctx"></div><div class="chat-log" id="chat-log" role="log" aria-label="Conversation" tabindex="0"></div>' +
      '<div class="chips-row">' + prompts.map(function (q) { return '<button type="button" class="btn btn-sm" data-action="mentor-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>' +
      '<form class="chat-form" data-form="mentor"><label class="sr-only" for="m-in">Message to the tutor</label><input class="input" id="m-in" data-testid="mentor-input" type="text" autocomplete="off" maxlength="2000" placeholder="Ask for a hint, a code review, or a concept"><button type="submit" class="btn btn-primary" data-testid="mentor-send">' + ic('send', { size: 16 }) + 'Send</button></form></div>';
    var log = document.getElementById('chat-log'), input = document.getElementById('m-in'), ctxEl = document.getElementById('chat-ctx');
    function paintCtx() {
      var c = mentorCtx(), p = c.problem;
      if (p) ctxEl.innerHTML = ic('code', { size: 16 }) + '<span>Looking at <strong>' + esc(p.title) + '</strong> (' + esc(C.LANG_NAMES[c.lang]) + (c.code ? ', draft included' : ', no draft yet') + ')</span><button type="button" class="btn btn-sm btn-ghost" data-action="mentor-ctx" style="margin-left:auto">Stop sharing</button>';
      else if (!mentorCtxOn && lastWsId) ctxEl.innerHTML = ic('info', { size: 16 }) + '<span>Challenge context is off.</span><button type="button" class="btn btn-sm btn-ghost" data-action="mentor-ctx" style="margin-left:auto">Share ' + esc(byId[lastWsId].title) + '</button>';
      else ctxEl.innerHTML = ic('info', { size: 16 }) + '<span>No challenge open. <a href="#/challenges">Open one</a> and I can give hints and review your code.</span>';
    }
    function addMsg(m) {
      var row = el('div', 'msg-row ' + (m.role === 'me' ? 'me' : 'bot')), who = el('span', 'who'), b = el('div', 'bubble');
      who.textContent = m.role === 'me' ? 'You' : 'Tutor';
      if (m.role === 'me') b.textContent = m.text; else { b.className = 'bubble fmt'; b.innerHTML = C.fmt(m.text); }
      row.appendChild(who); row.appendChild(b); log.appendChild(row);
      if (m.role !== 'me') row.setAttribute('data-testid', 'mentor-reply');
    }
    function send(text) {
      text = String(text || '').trim().slice(0, 2000);
      if (!text) return;
      var reply;
      try { reply = M.reply(text, mentorCtx(), mentorState).text; } catch (e) { reply = 'Something went wrong while I was answering. Try rephrasing.'; }
      chatLog.push({ role: 'me', text: text }, { role: 'bot', text: reply });
      if (chatLog.length > 200) chatLog.splice(0, 2);
      addMsg(chatLog[chatLog.length - 2]); addMsg(chatLog[chatLog.length - 1]);
      log.scrollTop = log.scrollHeight;
    }
    paintCtx();
    if (!M) { chatLog = [{ role: 'bot', text: 'The mentor module failed to load. Reload the page.' }]; input.disabled = true; }
    else if (!chatLog.length) chatLog.push({ role: 'bot', text: M.reply('what can you do', mentorCtx(), mentorState).text });
    chatLog.forEach(addMsg); log.scrollTop = log.scrollHeight;
    forms.mentor = function () { var v = input.value; input.value = ''; send(v); input.focus(); };
    actions['mentor-chip'] = function (t) { if (M) send(t.getAttribute('data-q')); };
    actions['mentor-ctx'] = function () { mentorCtxOn = !mentorCtxOn; paintCtx(); };
    return { title: 'Mentor', cleanup: function () { delete forms.mentor; } };
  }

  /* ------------------------------ event delegation ------------------------------ */
  var actions = {}, fields = {}, forms = {}, keyHandlers = {}, shortcuts = {};
  actions.theme = function () {
    var t = store.get().settings.theme, nt = THEMES[(THEMES.indexOf(t) + 1) % 3];
    store.update(function (s) { s.settings.theme = nt; }); applyTheme(); updateStatus(); announce('Theme: ' + nt + '.');
  };
  document.addEventListener('click', function (e) {
    var sk = e.target.closest ? e.target.closest('a.skip') : null;
    if (sk) { e.preventDefault(); view.focus(); return; } // a hash link would be read as an unknown route
    var t = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!t || t.disabled) return;
    var fn = actions[t.getAttribute('data-action')];
    if (fn) fn(t, e);
  });
  function onField(e) {
    var t = e.target; if (!t.getAttribute) return;
    var f = t.getAttribute('data-field'); if (f && fields[f] && (e.type === (t.tagName === 'SELECT' || t.type === 'file' ? 'change' : 'input'))) fields[f](t.value, t);
  }
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);
  document.addEventListener('submit', function (e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-form');
    if (!f) return;
    e.preventDefault();
    if (forms[f]) forms[f]();
  });
  document.addEventListener('keydown', function (e) {
    for (var k in shortcuts) if (has(shortcuts, k) && shortcuts[k](e)) return;
    var t = e.target;
    if (t && t.getAttribute) {
      if (t.getAttribute('role') === 'tab' && keyHandlers.tablist) return keyHandlers.tablist(e, t);
      if (t.id === 'tin' && keyHandlers.term) return keyHandlers.term(e);
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !(t.closest && t.closest('.CodeMirror')) && document.getElementById('f-q')) {
        e.preventDefault(); document.getElementById('f-q').focus();
      }
    }
  });

  /* ------------------------------ boot ------------------------------ */
  routes = { dashboard: viewDashboard, challenges: viewChallenges, challenge: viewChallenge, progress: viewProgress, terminal: viewTerminal, mentor: viewMentor };
  buildShell(); applyTheme(); updateStatus();
  store.subscribe(function () { updateStatus(); });
  window.addEventListener('hashchange', render);
  render();
})();
