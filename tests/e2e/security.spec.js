// Security regression suite: CSP, XSS, prototype pollution, sandbox isolation, timeouts, data leakage, import hardening, network egress.
const { test, expect } = require('@playwright/test');

const KEY = 'codeArsenal.v2';
const XSS = '<img src=x onerror=window.__pwn=1>';
const XSS2 = '"><svg onload=window.__pwn=1>';
const JS_URL = 'javascript:window.__pwn=1';
const SCRIPT_END = '</script><script>window.__pwn=1</script>';
const HIDDEN_A = '1836311903'; // hidden expected values of climbing-stairs
const HIDDEN_B = '1346269';
const CORRECT_STAIRS = 'function climbStairs(n){ let a=1,b=1; for(let i=2;i<=n;i++){ [a,b]=[b,a+b]; } return b; }';

async function seed(page, json) {
  await page.addInitScript(([k, v]) => {
    try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } } catch (e) { /* ignore */ }
  }, [KEY, json]);
}
async function watchCSP(page) {
  const seen = [];
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI), true);
  });
  page.on('console', (m) => { if (/Content.Security.Policy|Refused to (load|execute|apply|connect|create)/i.test(m.text())) seen.push('console: ' + m.text()); });
  page.on('pageerror', (e) => seen.push('pageerror: ' + e.message));
  return { seen, events: () => page.evaluate(() => window.__csp || []) };
}
async function boot(page, hash) {
  await page.goto('/app.html' + (hash || ''));
  await expect(page.getByTestId('level-display')).toBeVisible();
}
async function noPwn(page) {
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
  const injected = await page.evaluate(() => document.querySelectorAll('img[src="x"], svg[onload], [onerror], [onload], script:not([src])').length);
  expect(injected).toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll('a[href^="javascript:" i]').length)).toBe(0);
}
async function noPollution(page, baseline) {
  const r = await page.evaluate(() => ({ p: ({}).polluted, p2: Object.prototype.polluted, names: Object.getOwnPropertyNames(Object.prototype).sort() }));
  expect(r.p).toBeUndefined();
  expect(r.p2).toBeUndefined();
  expect(r.names).toEqual(baseline);
}
async function protoBaseline(context) {
  const p = await context.newPage();
  const names = await p.evaluate(() => Object.getOwnPropertyNames(Object.prototype).sort());
  await p.close();
  return names;
}
async function setCode(page, code) {
  await page.waitForSelector('.CodeMirror');
  await page.evaluate((c) => { document.querySelector('.CodeMirror').CodeMirror.setValue(c); }, code);
}
async function exec(page, mode) {
  await page.getByTestId(mode === 'submit' ? 'submit-btn' : 'run-btn').click();
}
async function storedState(page) {
  return page.evaluate((k) => localStorage.getItem(k), KEY);
}
async function openStairs(page) {
  await boot(page, '#/challenge/climbing-stairs');
  await expect(page.getByTestId('submit-btn')).toBeEnabled();
  await page.waitForSelector('.CodeMirror');
}

const HOSTILE_STATE = JSON.stringify({ v: 2 }).slice(0, -1) +
  ',"name":' + JSON.stringify(XSS) + ',"created":1,"lastOpened":"two-sum"' +
  ',"solved":{"__proto__":{"at":1,"lang":"js","attempts":1,"seconds":1,"xp":999},"constructor":{"xp":999},' + JSON.stringify(XSS) + ':{"xp":5}}' +
  ',"attempts":{"__proto__":9,"two-sum":2},"opened":{"__proto__":1}' +
  ',"drafts":{"two-sum:js":' + JSON.stringify(SCRIPT_END + XSS) + ',"__proto__:js":"x",' + JSON.stringify(XSS + ':js') + ':"y"}' +
  ',"xpLog":[{"id":"__proto__","xp":900,"at":1},{"id":"x","xp":9}]' +
  ',"achievements":{"__proto__":1,"first-solve":1}' +
  ',"streak":{"current":' + JSON.stringify(XSS) + ',"best":1,"last":' + JSON.stringify(XSS2) + '}' +
  ',"settings":{"lang":"<b>","theme":' + JSON.stringify(XSS2) + '}' +
  ',"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}}';

/* ------------------------------------------------ (a) CSP ------------------------------------------------ */
test.describe('CSP', () => {
  async function csp(page, url) {
    await page.goto(url);
    const c = await page.evaluate(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy" i]'); return m && m.getAttribute('content'); });
    expect(c, url + ' has a CSP meta').toBeTruthy();
    const d = {};
    c.split(';').forEach((s) => { const p = s.trim().split(/\s+/); if (p[0]) d[p[0]] = p.slice(1); });
    return d;
  }
  for (const url of ['/app.html', '/index.html']) {
    test('strict CSP on ' + url, async ({ page }) => {
      const d = await csp(page, url);
      expect(d['default-src']).toEqual(["'none'"]);
      expect(d['script-src']).toEqual(["'self'"]);
      expect(d['base-uri']).toEqual(["'none'"]);
      expect(d['form-action']).toEqual(["'none'"]);
      expect(d['connect-src']).toEqual(["'self'"]);
      for (const [k, v] of Object.entries(d)) {
        if (k !== 'style-src') expect(v.join(' '), k).not.toMatch(/unsafe-inline|unsafe-eval|\*|https?:/);
        expect(v.join(' '), k).not.toMatch(/\*|https?:|data:.*script/);
      }
      expect(d['script-src'].join(' ')).not.toMatch(/unsafe/);
      expect(await page.evaluate(() => document.querySelector('meta[name=referrer]').content)).toBe('no-referrer');
    });
  }
  test('sandbox CSP is minimal and only allows the Pyodide CDN', async ({ page }) => {
    const d = await csp(page, '/sandbox.html');
    expect(d['default-src']).toEqual(["'none'"]);
    expect(d['connect-src']).toEqual(['https://cdn.jsdelivr.net']);
    expect(d['worker-src']).toEqual(['blob:']);
    expect(d['style-src']).toEqual(["'none'"]);
    expect(d['script-src'].join(' ')).not.toMatch(/unsafe-inline|\*/);
    expect(d['script-src']).toContain('https://cdn.jsdelivr.net');
    for (const src of d['script-src']) expect(src).toMatch(/^('self'|'unsafe-eval'|'wasm-unsafe-eval'|blob:|https:\/\/cdn\.jsdelivr\.net)$/);
  });
  test('no CSP violations during normal use', async ({ page }) => {
    const w = await watchCSP(page);
    await openStairs(page);
    await setCode(page, CORRECT_STAIRS);
    await exec(page, 'run');
    await expect(page.getByTestId('result-summary')).toContainText('visible tests passed');
    for (const h of ['#/dashboard', '#/challenges', '#/progress', '#/terminal', '#/mentor']) {
      await page.evaluate((x) => { location.hash = x; }, h);
      await page.waitForTimeout(150);
    }
    await page.goto('/index.html');
    await page.waitForTimeout(300);
    expect(w.seen).toEqual([]);
    expect(await w.events()).toEqual([]);
  });
});

/* ------------------------------------------------ (b)(c) XSS and pollution ------------------------------------------------ */
test.describe('XSS and prototype pollution', () => {
  test('terminal echoes payloads as text', async ({ page, context }) => {
    const base = await protoBaseline(context);
    await boot(page, '#/terminal');
    const input = page.getByTestId('terminal-input');
    const out = page.locator('[data-testid=terminal] .term-out');
    for (const cmd of ['set name ' + XSS, XSS, XSS2, JS_URL, SCRIPT_END, 'open ' + XSS, 'list ' + XSS2, 'hint __proto__', 'help constructor', 'set name <svg onload=window.__pwn=1>']) {
      await input.fill(cmd);
      await input.press('Enter');
    }
    await expect(out).toContainText('arsenal $ ' + XSS);
    await expect(out).toContainText('Name set.');
    await input.fill('whoami');
    await input.press('Enter');
    await expect(out).toContainText('name:     <svg onload=window.__pwn=1>');
    await noPwn(page);
    await noPollution(page, base);
    // the stored name appears as text on the dashboard, too
    await page.evaluate(() => { location.hash = '#/challenge/two-sum'; });
    await page.waitForSelector('.CodeMirror');
    await page.evaluate(() => { location.hash = '#/dashboard'; });
    await expect(page.locator('#view')).toContainText('Welcome back, <svg onload=window.__pwn=1>');
    await noPwn(page);
    await expect(page).toHaveURL(/app\.html/);
  });

  test('mentor messages are rendered as text', async ({ page, context }) => {
    const base = await protoBaseline(context);
    await boot(page, '#/mentor');
    const input = page.getByTestId('mentor-input');
    for (const msg of [XSS, XSS2, JS_URL, SCRIPT_END, '`' + XSS + '` **' + XSS2 + '**', 'explain xss ' + XSS, 'hint ' + XSS, 'review ' + XSS]) {
      await input.fill(msg);
      await input.press('Enter');
    }
    const mine = page.locator('.msg-row.me .bubble');
    await expect(mine.first()).toHaveText(XSS);
    await expect(page.locator('.msg-row.me .bubble', { hasText: JS_URL })).toHaveCount(1);
    expect(await page.getByTestId('mentor-reply').count()).toBeGreaterThan(5);
    await noPwn(page);
    await noPollution(page, base);
    expect(await page.locator('.chat-log a').count()).toBe(0);
  });

  test('hostile URL hash and query', async ({ page, context }) => {
    const base = await protoBaseline(context);
    const enc = encodeURIComponent;
    const hashes = [
      '#/challenge/' + enc(XSS), '#/challenge/' + XSS, '#/challenge/__proto__', '#/challenge/constructor', '#/__proto__', '#/constructor/x', '#/toString',
      '#/challenges?q=' + enc(XSS) + '&track=__proto__&diff=constructor&status=__proto__&sort=__proto__&__proto__[polluted]=1&constructor[prototype][polluted]=1&polluted=1',
      '#/challenges?q=' + enc(XSS2) + '&__proto__=%7B%22polluted%22%3A1%7D',
      '#/challenges?q=' + enc(JS_URL + SCRIPT_END), '#/challenges?q=%E0%A4%A', '#/challenge/%E0%A4%A'
    ];
    await boot(page, '#/dashboard');
    for (const h of hashes) {
      await page.evaluate((x) => { location.hash = x; }, h);
      await page.waitForTimeout(120);
      await noPwn(page);
      await noPollution(page, base);
      await expect(page.locator('#view h1')).toBeVisible();
    }
    // unknown challenge ids fall back to the dashboard; reflected query is inert text in an input value
    await page.evaluate((x) => { location.hash = x; }, '#/challenge/' + enc(XSS));
    await expect(page).toHaveURL(/#\/dashboard$/);
    await page.evaluate((x) => { location.hash = x; }, '#/challenges?q=' + enc(XSS) + '&track=__proto__');
    await expect(page.getByTestId('search')).toHaveValue(XSS);
    await expect(page.getByTestId('filter-track')).toHaveValue('');
    await expect(page.getByTestId('empty-results')).toBeVisible();
    // the initial load with a hostile hash must also boot
    await boot(page, '#/challenges?q=' + enc(XSS) + '&track=__proto__');
    await noPwn(page);
    await boot(page, '#/challenge/' + enc(XSS2));
    await expect(page).toHaveURL(/#\/dashboard$/);
  });

  test('hostile localStorage state is sanitised', async ({ page, context }) => {
    const base = await protoBaseline(context);
    await seed(page, HOSTILE_STATE);
    await boot(page, '#/dashboard');
    await expect(page.getByTestId('xp-display')).toHaveText('0 XP');
    await expect(page.locator('#view')).toContainText('Welcome back, ' + XSS);
    await noPwn(page);
    await noPollution(page, base);
    for (const h of ['#/challenges', '#/progress', '#/terminal', '#/mentor', '#/challenge/two-sum', '#/dashboard']) {
      await page.evaluate((x) => { location.hash = x; }, h);
      await page.waitForTimeout(150);
      await noPwn(page);
    }
    await page.evaluate(() => { location.hash = '#/challenge/two-sum'; });
    await page.waitForSelector('.CodeMirror');
    const code = await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
    expect(code).toBe(SCRIPT_END + XSS); // shown as editor text, not parsed
    await noPwn(page);
    const saved = JSON.parse(await storedState(page));
    expect(Object.keys(saved.solved)).toEqual([]);
    expect(saved.xpLog).toEqual([]);
    expect(saved.settings).toEqual({ lang: 'js', theme: 'system' });
    expect(Object.prototype.hasOwnProperty.call(saved, 'constructor')).toBe(false);
    await noPollution(page, base);
  });

  test('hostile imported backup is sanitised', async ({ page, context }) => {
    const base = await protoBaseline(context);
    await boot(page, '#/progress');
    await page.getByTestId('import-input').setInputFiles({ name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(HOSTILE_STATE) });
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('data-msg')).toHaveText('Backup imported.');
    await noPwn(page);
    await page.evaluate(() => { location.hash = '#/dashboard'; });
    await expect(page.locator('#view')).toContainText('Welcome back, ' + XSS);
    await expect(page.getByTestId('xp-display')).toHaveText('0 XP');
    await noPwn(page);
    await noPollution(page, base);
    const saved = JSON.parse(await storedState(page));
    expect(Object.keys(saved.solved)).toEqual([]);
    expect(saved.drafts['two-sum:js']).toBe(SCRIPT_END + XSS);
    expect(Object.keys(saved.drafts)).toEqual(['two-sum:js']);
  });
});

/* ------------------------------------------------ (d) markup hygiene ------------------------------------------------ */
test('no inline handlers or scripts, and external links are noopener', async ({ page }) => {
  const check = async (label) => {
    const r = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('*').forEach((el) => { for (const a of el.attributes) if (/^on/i.test(a.name)) bad.push(el.tagName + '[' + a.name + ']'); });
      const inline = document.querySelectorAll('script:not([src])').length;
      const js = document.querySelectorAll('a[href^="javascript:" i], [src^="javascript:" i], form[action^="javascript:" i]').length;
      const blank = [...document.querySelectorAll('a[target]')].filter((a) => (a.target || '').toLowerCase() === '_blank')
        .filter((a) => !/\bnoopener\b/.test(a.rel) || !/\bnoreferrer\b/.test(a.rel)).map((a) => a.href);
      const external = [...document.querySelectorAll('a[href^="http"]')].filter((a) => new URL(a.href).origin !== location.origin)
        .filter((a) => !/\bnoopener\b/.test(a.rel) || !/\bnoreferrer\b/.test(a.rel)).map((a) => a.href);
      return { bad, inline, js, blank, external };
    });
    expect(r, label).toEqual({ bad: [], inline: 0, js: 0, blank: [], external: [] });
  };
  await page.goto('/index.html');
  await check('index');
  await page.goto('/sandbox.html');
  await check('sandbox');
  await boot(page, '#/dashboard');
  for (const h of ['#/dashboard', '#/challenges', '#/challenge/two-sum', '#/progress', '#/terminal', '#/mentor']) {
    await page.evaluate((x) => { location.hash = x; }, h);
    await page.waitForTimeout(150);
    await check('app ' + h);
  }
});

/* ------------------------------------------------ (e) sandbox isolation ------------------------------------------------ */
test.describe('sandbox', () => {
  test('hostile solution cannot reach the app or forge a pass', async ({ page }) => {
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await openStairs(page);
    const probe = [
      'function climbStairs(n){',
      '  var out=[];',
      '  function t(name,f){ try{ out.push(name+":"+f()); }catch(e){ out.push(name+":ERR "+e.name); } }',
      '  t("parent",function(){ return typeof parent+"/"+typeof self.parent; });',
      '  t("document",function(){ return typeof document; });',
      '  t("window",function(){ return typeof window; });',
      '  t("localStorage",function(){ return typeof localStorage; });',
      '  t("cookie",function(){ return typeof document === "undefined" ? "nodoc" : document.cookie; });',
      '  t("fetch",function(){ return typeof fetch; });',
      '  t("fetchCall",function(){ return fetch("https://example.com/?x=1"); });',
      '  t("xhr",function(){ return typeof XMLHttpRequest; });',
      '  t("ws",function(){ return typeof WebSocket; });',
      '  t("wsNew",function(){ new WebSocket("wss://example.com"); return "created"; });',
      '  t("importScripts",function(){ return typeof importScripts; });',
      '  t("importCall",function(){ importScripts("https://example.com/x.js"); return "loaded"; });',
      '  t("worker",function(){ return typeof Worker; });',
      '  t("viaThis",function(){ return typeof (new Function("return this"))().fetch; });',
      '  t("onmessage",function(){ return String(self.onmessage); });',
      '  try { self.postMessage({type:"result",nonce:"00",raw:{status:"done",results:[]}}); } catch(e) {}',
      '  try { self.postMessage({id:"'.concat('a'.repeat(32), '",type:"result",result:{status:"done",allPassed:true,passedCount:7,total:7,logs:[],results:[]}}); } catch(e) {}'),
      '  try { self.postMessage({type:"hello"}); } catch(e) {}',
      '  console.log(out.join("|"));',
      '  return -1;',
      '}'
    ].join('\n');
    await setCode(page, probe);
    await exec(page, 'submit');
    await expect(page.getByTestId('results')).toHaveAttribute('aria-busy', 'false', { timeout: 15000 });
    const con = await page.getByTestId('console').innerText();
    for (const want of ['parent:undefined/undefined', 'document:undefined', 'window:undefined', 'localStorage:undefined', 'cookie:nodoc', 'fetch:undefined',
      'fetchCall:ERR TypeError', 'xhr:undefined', 'ws:undefined', 'wsNew:ERR TypeError', 'importScripts:undefined', 'importCall:ERR TypeError', 'worker:undefined', 'viaThis:undefined']) {
      expect(con, want).toContain(want);
    }
    await expect(page.getByTestId('result-summary')).toContainText('0 of 7 tests passed');
    await expect(page.getByTestId('results')).toHaveAttribute('data-all-passed', 'false');
    await expect(page.getByTestId('solve-box')).toHaveCount(0);
    await expect(page.getByTestId('xp-display')).toHaveText('0 XP');
    const saved = JSON.parse(await storedState(page));
    expect(saved.solved).toEqual({});
    expect(saved.xpLog).toEqual([]);
    expect(saved.accepted).toBe(0);
    expect(reqs.filter((u) => /example\.com/.test(u))).toEqual([]);
    expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
  });

  test('messages forged from the page context are ignored', async ({ page }) => {
    await openStairs(page);
    const slow = 'var spun=false; function climbStairs(n){ if(!spun){ spun=true; var t=Date.now(); while(Date.now()-t<1500){} } return -1; }';
    await setCode(page, slow);
    await exec(page, 'submit');
    await page.evaluate(() => {
      const id = 'b'.repeat(32);
      const ok = { status: 'done', message: '', logs: [], passedCount: 7, total: 7, allPassed: true, results: [] };
      for (const m of [{ type: 'hello' }, { id, type: 'result', result: ok }, { id: 'zz', type: 'result', result: ok }]) window.postMessage(m, '*');
    });
    await expect(page.getByTestId('results')).toHaveAttribute('aria-busy', 'false', { timeout: 15000 });
    await expect(page.getByTestId('result-summary')).toContainText('0 of 7 tests passed');
    await expect(page.getByTestId('solve-box')).toHaveCount(0);
    await expect(page.getByTestId('xp-display')).toHaveText('0 XP');
    expect(JSON.parse(await storedState(page)).solved).toEqual({});
  });

  test('iframe is sandbox="allow-scripts" with an opaque origin', async ({ page }) => {
    await openStairs(page);
    await setCode(page, CORRECT_STAIRS);
    await exec(page, 'run');
    await expect(page.getByTestId('result-summary')).toContainText('visible tests passed');
    const info = await page.evaluate(() => {
      const f = document.querySelector('iframe');
      let access = 'no error';
      try { access = String(f.contentWindow.document.title); } catch (e) { access = e.name; }
      let storage = 'no error';
      try { storage = String(f.contentWindow.localStorage); } catch (e) { storage = e.name; }
      return { count: document.querySelectorAll('iframe').length, attr: f.getAttribute('sandbox'), tokens: [...f.sandbox], doc: f.contentDocument, access, storage };
    });
    expect(info.count).toBe(1);
    expect(info.attr).toBe('allow-scripts');
    expect(info.tokens).toEqual(['allow-scripts']);
    expect(info.doc).toBeNull();
    expect(info.access).toBe('SecurityError');
    expect(info.storage).toBe('SecurityError');
    const frame = page.frames().find((f) => /sandbox\.html/.test(f.url()));
    expect(frame).toBeTruthy();
    const inner = await frame.evaluate(() => {
      const r = {};
      try { r.ls = String(localStorage); } catch (e) { r.ls = e.name; }
      try { r.cookie = document.cookie; } catch (e) { r.cookie = e.name; }
      try { r.parentDoc = String(parent.document.title); } catch (e) { r.parentDoc = e.name; }
      try { r.top = String(top.location.href); } catch (e) { r.top = e.name; }
      return r;
    });
    expect(inner).toEqual({ ls: 'SecurityError', cookie: 'SecurityError', parentDoc: 'SecurityError', top: 'SecurityError' });
  });
});

/* ------------------------------------------------ (f) timeout ------------------------------------------------ */
test('infinite loop times out, app stays responsive, correct code passes afterwards', async ({ page }) => {
  test.setTimeout(40000);
  await openStairs(page);
  await setCode(page, 'function climbStairs(n){ while(true){} }');
  const t0 = Date.now();
  await exec(page, 'run');
  const toggle = page.getByTestId('theme-toggle');
  const before = await toggle.getAttribute('aria-label');
  await page.waitForTimeout(800);
  await toggle.click(); // main thread must be free while the loop spins
  await expect(toggle).not.toHaveAttribute('aria-label', before, { timeout: 2000 });
  await expect(page.getByTestId('result-error')).toContainText('Time limit exceeded', { timeout: 8000 });
  expect(Date.now() - t0).toBeLessThan(6500);
  await expect(page.getByTestId('run-btn')).toBeEnabled();
  expect(await page.locator('iframe').count()).toBe(0); // frame destroyed with the worker
  await setCode(page, CORRECT_STAIRS);
  await exec(page, 'submit');
  await expect(page.getByTestId('solve-box')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('results')).toHaveAttribute('data-all-passed', 'true');
});

/* ------------------------------------------------ (h) hidden tests do not leak ------------------------------------------------ */
test('hidden expected values never reach the DOM, storage or messages', async ({ page }) => {
  await page.addInitScript(() => { window.__msgs = []; window.addEventListener('message', (e) => { try { window.__msgs.push(JSON.stringify(e.data)); } catch (x) { /* ignore */ } }, true); });
  await openStairs(page);
  const scan = async (label) => {
    const r = await page.evaluate(([a, b]) => {
      const hay = [document.documentElement.outerHTML, document.body.innerText, JSON.stringify(localStorage), JSON.stringify(sessionStorage), (window.__msgs || []).join('\n'), document.title];
      return hay.map((h) => h.indexOf(a) >= 0 || h.indexOf(b) >= 0);
    }, [HIDDEN_A, HIDDEN_B]);
    expect(r, label).toEqual([false, false, false, false, false, false]);
  };
  await scan('before');
  await setCode(page, 'function climbStairs(n){ return 1; }'); // wrong: hidden rows show errors/failures
  await exec(page, 'submit');
  await expect(page.getByTestId('results')).toHaveAttribute('aria-busy', 'false', { timeout: 15000 });
  await expect(page.getByTestId('test-row').last()).toContainText('Hidden test');
  await scan('after failing submit');
  await setCode(page, CORRECT_STAIRS);
  await exec(page, 'submit');
  await expect(page.getByTestId('solve-box')).toBeVisible({ timeout: 15000 });
  await scan('after passing submit');
  await page.getByTestId('tab-notes').click();
  await page.evaluate(() => { location.hash = '#/progress'; });
  await expect(page.locator('#view h1')).toHaveText('Progress');
  await scan('progress');
  expect((await page.evaluate(() => window.__msgs.length))).toBeGreaterThan(0);
});

/* ------------------------------------------------ (i) oversized code ------------------------------------------------ */
test('oversized code is rejected without running', async ({ page }) => {
  await openStairs(page);
  await setCode(page, 'function climbStairs(n){ return 1; }\n// ' + 'x'.repeat(50100));
  await exec(page, 'run');
  await expect(page.getByTestId('result-error')).toContainText('too long');
  await expect(page.getByTestId('run-btn')).toBeEnabled();
  expect(await page.locator('iframe').count()).toBe(0);
  await page.waitForTimeout(900); // draft autosave interval
  const saved = JSON.parse((await storedState(page)) || '{"drafts":{}}');
  for (const v of Object.values(saved.drafts)) expect(v.length).toBeLessThanOrEqual(50000);
  await setCode(page, CORRECT_STAIRS);
  await exec(page, 'run');
  await expect(page.getByTestId('result-summary')).toContainText('visible tests passed');
});

/* ------------------------------------------------ (j) import hardening ------------------------------------------------ */
test('oversized and invalid backups are rejected and leave state unchanged', async ({ page }) => {
  const seeded = JSON.stringify({ v: 2, name: 'Keeper', solved: { 'climbing-stairs': { at: 1, lang: 'js', attempts: 1, seconds: 10, xp: 25 } } });
  await seed(page, seeded);
  await boot(page, '#/progress');
  await expect(page.getByTestId('xp-display')).toHaveText('25 XP');
  const msg = page.getByTestId('data-msg');
  const imp = page.getByTestId('import-input');
  await imp.setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(5000001, 32) });
  await expect(msg).toContainText('larger than 5 MB');
  await expect(msg).toHaveClass(/err/);
  expect(await storedState(page)).toBe(seeded);
  for (const body of ['{not json', '[]', '"__proto__"', 'null', '{"v":3}', '{"v":"2"}', '\u0000\u0001garbage']) {
    await page.evaluate(() => { document.getElementById('data-msg').textContent = ''; });
    await imp.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(body) });
    await expect(msg, body).toContainText('not a Code Arsenal backup');
    await expect(msg).toHaveClass(/err/);
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    expect(await storedState(page), body).toBe(seeded);
  }
  await expect(page.getByTestId('xp-display')).toHaveText('25 XP');
  // declining the confirmation also leaves state untouched
  await imp.setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from('{"v":2,"name":"Other"}') });
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await storedState(page)).toBe(seeded);
});

/* ------------------------------------------------ (k) network egress ------------------------------------------------ */
test('a JavaScript-only session talks to 127.0.0.1 and nothing else', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/index.html');
  await boot(page, '#/dashboard');
  for (const h of ['#/challenges', '#/progress', '#/mentor']) { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); }
  await page.evaluate(() => { location.hash = '#/challenge/climbing-stairs'; });
  await page.waitForSelector('.CodeMirror');
  await setCode(page, CORRECT_STAIRS);
  await exec(page, 'submit');
  await expect(page.getByTestId('solve-box')).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { location.hash = '#/terminal'; });
  const input = page.getByTestId('terminal-input');
  await input.fill('status');
  await input.press('Enter');
  await expect(page.locator('.term-out')).toContainText('level');
  const net = urls.filter((u) => /^https?:/i.test(u));
  expect(net.length).toBeGreaterThan(5);
  const hosts = [...new Set(net.map((u) => new URL(u).host))];
  expect(hosts).toEqual(['127.0.0.1:' + (process.env.PORT || 4173)]);
});

/* ------------------------------------------------ e2e debug hook ------------------------------------------------ */
test('the e2e debug hook exists only behind ?e2e=1', async ({ page }) => {
  await boot(page, '#/dashboard');
  expect(await page.evaluate(() => typeof window.__CA_APP__)).toBe('undefined');
  expect(await page.evaluate(() => Object.keys(window).filter((k) => /^__/.test(k)))).toEqual(expect.not.arrayContaining(['__CA_APP__']));
  await page.goto('/app.html?e2e=1#/dashboard');
  await expect(page.getByTestId('level-display')).toBeVisible();
  expect(await page.evaluate(() => typeof window.__CA_APP__)).toBe('object');
  // a hash or query value that merely contains the text must not enable it
  await page.goto('/app.html#/dashboard?e2e=1');
  await expect(page.getByTestId('level-display')).toBeVisible();
  expect(await page.evaluate(() => typeof window.__CA_APP__)).toBe('undefined');
});
