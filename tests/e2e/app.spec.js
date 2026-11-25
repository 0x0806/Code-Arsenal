// End-to-end tests for the app shell (app.html). Every assertion uses auto-waiting expects.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// Catalogue in Node, straight from the shipped source files.
const { problems, core } = require('../unit/load.js');
const IDS = problems.map((p) => p.id);
const BY_ID = Object.fromEntries(problems.map((p) => [p.id, p]));
const APP = '/app.html?e2e=1';

/* ------------------------------ helpers ------------------------------ */
async function watch(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => { if (!/favicon/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  return errors;
}
async function openApp(page, hash) {
  await page.goto(APP + (hash || '#/dashboard'));
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.locator('h1').first()).toBeVisible();
}
const xpText = (page) => page.getByTestId('xp-display');
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('codeArsenal.v2') || 'null'));
async function setCode(page, code) {
  const input = page.getByTestId('editor-input');
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}
const getCode = (page) => page.locator('.CodeMirror').evaluate((e) => e.CodeMirror.getValue());
async function chooseLang(page, lang) {
  await page.getByTestId('lang-' + lang).click();
  await expect(page.getByTestId('lang-' + lang)).toHaveAttribute('aria-pressed', 'true');
}
/** Open a problem, enter its reference solution through the editor and submit through the button. */
async function solveViaUI(page, id, lang, timeout) {
  await openApp(page, '#/challenge/' + id);
  if (lang !== 'js') await chooseLang(page, lang);
  await setCode(page, BY_ID[id].solutions[lang]);
  await page.getByTestId('submit-btn').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-status', /.+/, { timeout: timeout || 30000 });
  await expect(page.getByTestId('results')).toHaveAttribute('data-all-passed', 'true');
}
async function runTerm(page, line) {
  const input = page.getByTestId('terminal-input');
  await input.fill(line);
  await input.press('Enter');
}
const termOut = (page) => page.locator('#tout');

/* ------------------------------ boot and shell ------------------------------ */
test.describe('boot and shell', () => {
  test('boots with zero console errors and zero CSP violations on every route', async ({ page }) => {
    const errors = await watch(page);
    for (const hash of ['#/dashboard', '#/challenges', '#/challenge/two-sum', '#/progress', '#/terminal', '#/mentor']) {
      await openApp(page, hash);
    }
    expect(await page.evaluate(() => window.__csp)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('fresh user is at 0 XP, level 1, with an obvious first action', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('level-display')).toHaveText('Level 1');
    await expect(xpText(page)).toHaveText('0 XP');
    await expect(page.getByTestId('streak-display')).toContainText('0 days');
    const cta = page.getByTestId('continue-btn');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText(/Open first challenge/);
    await cta.click();
    await expect(page).toHaveURL(/#\/challenge\/[a-z0-9-]+$/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('every route renders its heading and sets a unique title', async ({ page }) => {
    const expected = {
      '#/dashboard': ['Dashboard', 'Dashboard · Code Arsenal'],
      '#/challenges': ['Challenges', 'Challenges · Code Arsenal'],
      '#/challenge/two-sum': [BY_ID['two-sum'].title, BY_ID['two-sum'].title + ' · Code Arsenal'],
      '#/progress': ['Progress', 'Progress · Code Arsenal'],
      '#/terminal': ['Terminal', 'Terminal · Code Arsenal'],
      '#/mentor': ['Mentor', 'Mentor · Code Arsenal']
    };
    const titles = new Set();
    for (const [hash, [h1, title]] of Object.entries(expected)) {
      await openApp(page, hash);
      await expect(page.locator('main h1')).toHaveText(h1);
      await expect(page).toHaveTitle(title);
      titles.add(title);
    }
    expect(titles.size).toBe(6);
  });

  test('unknown routes and bad challenge ids fall back to the dashboard', async ({ page }) => {
    for (const bad of ['#/nope', '#/challenge/does-not-exist', '#/challenge', '#/challenge/%E0%A4%A', '#/__proto__', '#/constructor']) {
      await openApp(page, bad);
      await expect(page.locator('main h1')).toHaveText('Dashboard');
      await expect(page).toHaveURL(/#\/dashboard$/);
    }
  });

  test('nav works by clicking the icon, the label, and from the keyboard', async ({ page }) => {
    await openApp(page);
    const targets = { challenges: 'Challenges', progress: 'Progress', terminal: 'Terminal', mentor: 'Mentor', dashboard: 'Dashboard' };
    for (const [id, h1] of Object.entries(targets)) {
      // icon
      await page.getByTestId('nav-' + (id === 'dashboard' ? 'progress' : 'dashboard')).click();
      await page.getByTestId('nav-' + id).locator('svg').click();
      await expect(page).toHaveURL(new RegExp('#/' + id + '$'));
      await expect(page.locator('main h1')).toHaveText(h1);
      await expect(page.getByTestId('nav-' + id)).toHaveAttribute('aria-current', 'page');
      // label
      await page.getByTestId('nav-' + (id === 'dashboard' ? 'progress' : 'dashboard')).click();
      await page.getByTestId('nav-' + id).locator('span').click();
      await expect(page).toHaveURL(new RegExp('#/' + id + '$'));
      await expect(page.locator('main h1')).toHaveText(h1);
    }
    // keyboard
    await page.getByTestId('nav-mentor').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/mentor$/);
    await page.getByTestId('nav-challenges').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/challenges$/);
    await expect(page.locator('main h1')).toBeFocused();
  });

  test('skip link moves focus to the content without changing the route', async ({ page }) => {
    await openApp(page, '#/challenges');
    await page.keyboard.press('Tab');
    const skip = page.locator('a.skip');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#view')).toBeFocused();
    await expect(page.locator('main h1')).toHaveText('Challenges');
  });

  test('theme toggle cycles, applies data-theme and persists across reload', async ({ page }) => {
    await openApp(page);
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', /.+/);
    await page.getByTestId('theme-toggle').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('theme-toggle').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect((await state(page)).settings.theme).toBe('dark');
    await page.getByTestId('theme-toggle').click();
    await expect(html).not.toHaveAttribute('data-theme', /.+/);
  });

  test('keyboard focus is visible on links, buttons and inputs', async ({ page }) => {
    await openApp(page, '#/challenges');
    for (const sel of ['[data-testid=nav-progress]', '[data-testid=theme-toggle]', '[data-testid=search]', '[data-testid=sort-title]']) {
      await page.locator(sel).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ok = await page.locator(sel).evaluate((e) => {
        const s = getComputedStyle(e);
        return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
      });
      expect(ok, sel + ' needs a visible focus indicator').toBe(true);
    }
  });
});

/* ------------------------------ challenge list ------------------------------ */
test.describe('challenge list', () => {
  test('lists all 41 problems and filters, sorts and shows the empty state', async ({ page }) => {
    expect(IDS.length).toBe(41);
    await openApp(page, '#/challenges');
    await expect(page.getByTestId('count')).toHaveText(/Showing 41 of 41 challenges/);
    await expect(page.locator('[data-testid^=problem-]:not([data-testid=problem-table])')).toHaveCount(41);

    // search
    await page.getByTestId('search').fill('two sum');
    await expect(page.getByTestId('problem-two-sum')).toBeVisible();
    await expect(page.getByTestId('count')).toHaveText(/Showing 1 of 41/);
    // empty state
    await page.getByTestId('search').fill('zzzqqq-no-such-thing');
    await expect(page.getByTestId('empty-results')).toBeVisible();
    await page.getByTestId('empty-results').getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByTestId('count')).toHaveText(/Showing 41 of 41/);
    await expect(page.getByTestId('search')).toBeFocused();

    // track filter
    const algos = problems.filter((p) => p.category === 'algorithms').length;
    await page.getByTestId('filter-track').selectOption('algorithms');
    await expect(page.getByTestId('count')).toHaveText(new RegExp('Showing ' + algos + ' of 41'));
    // difficulty filter combined
    const algoAdv = problems.filter((p) => p.category === 'algorithms' && p.difficulty === 'advanced').length;
    await page.getByTestId('filter-diff').selectOption('advanced');
    await expect(page.getByTestId('count')).toHaveText(new RegExp('Showing ' + algoAdv + ' of 41'));
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByTestId('count')).toHaveText(/Showing 41 of 41/);

    // status filter: nothing solved, everything not started
    await page.getByTestId('filter-status').selectOption('solved');
    await expect(page.getByTestId('empty-results')).toBeVisible();
    await page.getByTestId('filter-status').selectOption('todo');
    await expect(page.getByTestId('count')).toHaveText(/Showing 41 of 41/);
  });

  test('sorting by title and XP reorders rows and exposes aria-sort', async ({ page }) => {
    await openApp(page, '#/challenges');
    const titles = () => page.locator('.t-title a').allTextContents();
    await page.getByTestId('sort-title').click();
    const asc = [...problems].map((p) => p.title).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
    await expect.poll(titles).toEqual(asc);
    await expect(page.locator('th[aria-sort=ascending]')).toHaveCount(1);
    await page.getByTestId('sort-title').click();
    await expect.poll(titles).toEqual([...asc].reverse());
    await expect(page.locator('th[aria-sort=descending]')).toHaveCount(1);
    await page.getByTestId('sort-xp').click();
    await expect.poll(async () => {
      const xs = (await page.locator('td.col-xp').allTextContents()).map(Number);
      return xs.every((v, i) => i === 0 || xs[i - 1] <= v);
    }).toBe(true);
  });

  test('opening a problem from the list shows its statement, tests and editor', async ({ page }) => {
    await openApp(page, '#/challenges');
    await page.getByTestId('search').fill('Binary Search');
    await page.locator('.t-title a', { hasText: 'Binary Search' }).first().click();
    await expect(page).toHaveURL(/#\/challenge\/binary-search/);
    await expect(page.locator('main h1')).toHaveText('Binary Search');
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(page.getByTestId('run-btn')).toBeEnabled();
    await expect(page.getByTestId('submit-btn')).toBeEnabled();
    expect(await getCode(page)).toContain('function binarySearch');
  });
});

/* ------------------------------ run / submit ------------------------------ */
test.describe('run and submit', () => {
  test('Run on the empty starter fails visibly and changes no progress', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await page.getByTestId('run-btn').click();
    await expect(page.getByTestId('result-summary')).toHaveText(/^0 of \d+ visible tests passed/);
    await expect(page.getByTestId('results')).toContainText('Run only. Progress is unchanged.');
    const rows = page.getByTestId('test-row');
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(page.locator('[data-testid=test-row][data-passed=true]')).toHaveCount(0);
    await expect(page.getByTestId('solve-box')).toHaveCount(0);
    await expect(xpText(page)).toHaveText('0 XP');
    const s = await state(page);
    expect(s.submissions).toBe(0);
    expect(s.accepted).toBe(0);
    expect(Object.keys(s.solved)).toEqual([]);
    expect(s.attempts['two-sum'] || 0).toBe(0);
  });

  test('a wrong submission fails with per-test results, records an attempt and awards nothing', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await setCode(page, 'function twoSum(nums, target) { return [0, 0]; }');
    await page.getByTestId('submit-btn').click();
    await expect(page.getByTestId('results')).toHaveAttribute('data-status', 'done');
    await expect(page.getByTestId('results')).toHaveAttribute('data-all-passed', 'false');
    await expect(page.getByTestId('result-summary')).toHaveText(new RegExp('of ' + BY_ID['two-sum'].tests.length + ' tests passed'));
    await expect(page.getByTestId('results')).toContainText('Not yet');
    await expect(page.getByTestId('test-row')).toHaveCount(BY_ID['two-sum'].tests.length);
    expect(await page.locator('[data-testid=test-row][data-passed=false]').count()).toBeGreaterThan(0);
    await expect(page.getByTestId('xp-awarded')).toHaveCount(0);
    await expect(xpText(page)).toHaveText('0 XP');
    const s = await state(page);
    expect(s.submissions).toBe(1);
    expect(s.attempts['two-sum']).toBe(1);
    expect(Object.keys(s.solved)).toEqual([]);
  });

  test('syntax and runtime errors are reported, not swallowed', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await setCode(page, 'function twoSum(nums, target) { return ;;; ) }');
    await page.getByTestId('run-btn').click();
    await expect(page.getByTestId('result-error')).toBeVisible();
    await setCode(page, 'function twoSum(nums, target) { throw new Error("boom"); }');
    await page.getByTestId('run-btn').click();
    await expect(page.getByTestId('results')).toContainText(/boom/);
  });

  test('an infinite loop is stopped with a time limit message', async ({ page }) => {
    test.setTimeout(90000);
    await openApp(page, '#/challenge/two-sum');
    await setCode(page, 'function twoSum(nums, target) { while (true) {} }');
    await page.getByTestId('run-btn').click();
    await expect(page.getByTestId('results')).toHaveAttribute('data-status', /timeout|error/, { timeout: 60000 });
    await expect(page.getByTestId('result-error')).toBeVisible();
    await expect(page.getByTestId('run-btn')).toBeEnabled();
  });

  test('Ctrl+Enter runs the visible tests from the editor', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await page.getByTestId('editor-input').focus();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('result-summary')).toBeVisible();
    await expect(page.getByTestId('results')).toContainText('Run only');
  });

  test('XP is awarded exactly once; header matches; re-submit awards nothing; level-up and achievements show', async ({ page }) => {
    const expert = problems.find((p) => p.difficulty === 'expert');
    await solveViaUI(page, expert.id, 'js');
    const award = await page.getByTestId('xp-awarded').innerText();
    const n = Number(/\+(\d+) XP/.exec(award)[1]);
    expect(n).toBeGreaterThanOrEqual(expert.xp * 0.5);
    await expect(xpText(page)).toHaveText(n.toLocaleString() + ' XP');
    const box = page.getByTestId('solve-box');
    await expect(box).toContainText(/Level up: you are now level \d+/);
    await expect(box).toContainText('Achievement: First Blood');
    await expect(box).toContainText('Achievement: Deep End');
    await expect(page.getByTestId('level-display')).not.toHaveText('Level 1');
    await expect(page.locator('#toasts')).toContainText(/Level up|achievement/i);
    expect(core.levelFromXP(n)).toBeGreaterThan(1);

    // submit the same solution again
    await page.getByTestId('submit-btn').click();
    await expect(page.getByTestId('solve-box')).toContainText('no extra XP');
    await expect(page.getByTestId('xp-awarded')).toHaveCount(0);
    await expect(xpText(page)).toHaveText(n.toLocaleString() + ' XP');
    const s = await state(page);
    expect(s.solved[expert.id].xp).toBe(n);
    expect(s.xpLog.length).toBe(1);

    // a second problem: header equals the sum of both awards
    const beginner = problems.find((p) => p.difficulty === 'beginner');
    await solveViaUI(page, beginner.id, 'js');
    const m = Number(/\+(\d+) XP/.exec(await page.getByTestId('xp-awarded').innerText())[1]);
    await expect(xpText(page)).toHaveText((n + m).toLocaleString() + ' XP');
    const s2 = await state(page);
    expect(Object.values(s2.solved).reduce((a, v) => a + v.xp, 0)).toBe(n + m);

    // progress persists across reload, and the streak is shown
    await page.reload();
    await expect(xpText(page)).toHaveText((n + m).toLocaleString() + ' XP');
    await expect(page.getByTestId('streak-display')).toContainText('1 day');
    await page.goto(APP + '#/progress');
    await expect(page.getByTestId('ach-first-solve')).toHaveClass(/earned/);
    await expect(page.getByTestId('ach-expert')).toHaveClass(/earned/);
    await expect(page.getByTestId('ach-solve-30')).toHaveClass(/locked/);
  });

  test('solution notes unlock after solving', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await page.getByTestId('tab-notes').click();
    await expect(page.getByText('Locked until you solve this challenge.')).toBeVisible();
    await setCode(page, BY_ID['two-sum'].solutions.js);
    await page.getByTestId('submit-btn').click();
    await expect(page.getByTestId('solve-box')).toBeVisible();
    await expect(page.getByText('Locked until you solve this challenge.')).toHaveCount(0);
    await expect(page.locator('#tabpanel')).toContainText('Editorial');
  });
});

/* ------------------------------ hints and drafts ------------------------------ */
test.describe('hints and drafts', () => {
  test('hints reveal one at a time', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    const total = BY_ID['two-sum'].hints.length;
    await page.getByTestId('tab-hints').click();
    await expect(page.locator('.hint-item')).toHaveCount(0);
    for (let i = 1; i <= total; i++) {
      await page.getByTestId('reveal-hint').click();
      await expect(page.locator('.hint-item')).toHaveCount(i);
    }
    await expect(page.getByTestId('reveal-hint')).toHaveCount(0);
    await expect(page.locator('.hint-item').first()).toContainText('Hint 1 of ' + total);
  });

  test('tabs support arrow-key navigation', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await page.getByTestId('tab-desc').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('tab-hints')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('tab-hints')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByTestId('tab-notes')).toHaveAttribute('aria-selected', 'true');
  });

  test('drafts persist per problem and language, and switching language keeps them separate', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    const jsDraft = 'function twoSum(nums, target) { /* js draft */ return []; }';
    await setCode(page, jsDraft);
    await chooseLang(page, 'py'); // saves the js draft first
    expect(await getCode(page)).toBe(BY_ID['two-sum'].starter.py);
    const pyDraft = 'def two_sum(nums, target):\n    # py draft\n    return []\n';
    await setCode(page, pyDraft);
    await chooseLang(page, 'js');
    expect(await getCode(page)).toBe(jsDraft);
    await chooseLang(page, 'py');
    expect(await getCode(page)).toBe(pyDraft);

    // another problem is untouched
    await openApp(page, '#/challenge/binary-search');
    expect(await getCode(page)).toBe(BY_ID['binary-search'].starter.py);

    // survives a reload
    await expect.poll(async () => (await state(page)).drafts['two-sum:py']).toBe(pyDraft);
    await page.goto(APP + '#/challenge/two-sum');
    await expect(page.getByTestId('lang-py')).toHaveAttribute('aria-pressed', 'true');
    expect(await getCode(page)).toBe(pyDraft);
    await chooseLang(page, 'js');
    expect(await getCode(page)).toBe(jsDraft);
  });

  test('Reset code asks first and restores the starter', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await setCode(page, 'function twoSum() { return 1; }');
    await page.getByTestId('reset-code').click();
    const dlg = page.getByTestId('confirm-dialog');
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId('reset-code')).toBeFocused();
    expect(await getCode(page)).toContain('return 1');
    await page.getByTestId('reset-code').click();
    await page.getByTestId('confirm-ok').click();
    await expect.poll(() => getCode(page)).toBe(BY_ID['two-sum'].starter.js);
  });
});

/* ------------------------------ terminal ------------------------------ */
test.describe('terminal', () => {
  test('commands: help, stats, list, hint, theme, history, clear, unknown, open', async ({ page }) => {
    await openApp(page, '#/terminal');
    await expect(page.getByTestId('terminal-input')).toBeFocused();
    await runTerm(page, 'help');
    await expect(termOut(page)).toContainText('Commands (type help <command> for usage)');
    await runTerm(page, 'stats');
    await expect(termOut(page)).toContainText('level 1 Rookie');
    await expect(termOut(page)).toContainText('Solved: 0/41');
    await runTerm(page, 'list');
    await expect(termOut(page)).toContainText('41 challenge(s)');
    await runTerm(page, 'list algorithms');
    await expect(termOut(page)).toContainText(problems.filter((p) => p.category === 'algorithms').length + ' challenge(s)');
    await runTerm(page, 'hint two-sum');
    await expect(termOut(page)).toContainText('Hint 1/' + BY_ID['two-sum'].hints.length + ' for Two Sum');
    await runTerm(page, 'hlep');
    await expect(termOut(page)).toContainText('Did you mean help?');
    await runTerm(page, 'open two-sun');
    await expect(termOut(page)).toContainText('Did you mean two-sum?');
    await runTerm(page, 'theme dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await runTerm(page, 'history');
    await expect(termOut(page)).toContainText('theme dark');
    await runTerm(page, 'clear');
    await expect(page.locator('#tout .ln')).toHaveCount(0);
    await runTerm(page, 'open two-sum');
    await expect(page).toHaveURL(/#\/challenge\/two-sum$/);
    await expect(page.locator('main h1')).toHaveText('Two Sum');
  });

  test('history keys recall earlier commands and output survives navigation', async ({ page }) => {
    await openApp(page, '#/terminal');
    await runTerm(page, 'streak');
    await runTerm(page, 'ranks');
    await page.getByTestId('terminal-input').press('ArrowUp');
    await expect(page.getByTestId('terminal-input')).toHaveValue('ranks');
    await page.getByTestId('terminal-input').press('ArrowUp');
    await expect(page.getByTestId('terminal-input')).toHaveValue('streak');
    await page.getByTestId('terminal-input').press('ArrowDown');
    await expect(page.getByTestId('terminal-input')).toHaveValue('ranks');
    await page.getByTestId('terminal-input').fill('he');
    await page.getByTestId('terminal-input').press('Tab');
    await expect(page.getByTestId('terminal-input')).toHaveValue(/^help /);
    await page.getByTestId('nav-mentor').click();
    await page.getByTestId('nav-terminal').click();
    await expect(termOut(page)).toContainText('Current streak');
  });

  test('reset needs --confirm and then erases progress', async ({ page }) => {
    await openApp(page, '#/terminal');
    await page.evaluate(() => window.__CA_APP__.store.update((s) => {
      s.solved['two-sum'] = { at: Date.now(), lang: 'js', attempts: 1, seconds: 60, xp: 30 };
    }));
    await expect(xpText(page)).toHaveText('30 XP');
    await runTerm(page, 'reset');
    await expect(termOut(page)).toContainText('permanently erases');
    await expect(xpText(page)).toHaveText('30 XP');
    await runTerm(page, 'reset --confirm');
    await expect(termOut(page)).toContainText('All progress erased.');
    await expect(xpText(page)).toHaveText('0 XP');
  });

  test('terminal output is text, not markup', async ({ page }) => {
    await openApp(page, '#/terminal');
    await runTerm(page, '<img src=x onerror=window.__pwn=1>');
    await expect(termOut(page)).toContainText('Unknown command');
    expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
    await expect(page.locator('#tout img')).toHaveCount(0);
  });
});

/* ------------------------------ mentor ------------------------------ */
test.describe('mentor', () => {
  test('replies, and is labelled as a rule-based offline tutor', async ({ page }) => {
    await openApp(page, '#/mentor');
    await expect(page.locator('main')).toContainText(/rule-based/i);
    await expect(page.locator('main')).toContainText(/not an AI model/i);
    await expect(page.getByTestId('mentor-reply')).toHaveCount(1); // greeting
    await page.getByTestId('mentor-input').fill('Explain hash maps');
    await page.getByTestId('mentor-send').click();
    await expect(page.getByTestId('mentor-reply')).toHaveCount(2);
    await expect(page.getByTestId('mentor-reply').last()).toContainText(/hash|map|key/i);
    await page.getByTestId('mentor-input').fill('Explain big-O');
    await page.getByTestId('mentor-input').press('Enter');
    await expect(page.getByTestId('mentor-reply')).toHaveCount(3);
    await page.getByRole('button', { name: 'Give me a hint' }).click();
    await expect(page.getByTestId('mentor-reply')).toHaveCount(4);
  });

  test('mentor sees the open challenge', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await page.getByTestId('nav-mentor').click();
    await expect(page.locator('#chat-ctx')).toContainText('Two Sum');
    await page.getByRole('button', { name: 'Give me a hint' }).click();
    await expect(page.getByTestId('mentor-reply')).toHaveCount(2);
  });

  test('user text is not interpreted as HTML', async ({ page }) => {
    await openApp(page, '#/mentor');
    await page.getByTestId('mentor-input').fill('<img src=x onerror=window.__pwn=1>');
    await page.getByTestId('mentor-input').press('Enter');
    await expect(page.getByTestId('mentor-reply')).toHaveCount(2);
    expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
    await expect(page.locator('.chat-log img')).toHaveCount(0);
  });
});

/* ------------------------------ progress page ------------------------------ */
test.describe('progress page', () => {
  test('lists every achievement as locked on a fresh profile', async ({ page }) => {
    await openApp(page, '#/progress');
    await expect(page.locator('[data-testid^=ach-]')).toHaveCount(core.ACHIEVEMENTS.length);
    await expect(page.locator('[data-testid^=ach-].earned')).toHaveCount(0);
    await expect(page.locator('main')).toContainText('0 of ' + core.ACHIEVEMENTS.length + ' earned');
  });

  test('export and import round trip restores progress', async ({ page }, info) => {
    await openApp(page, '#/progress');
    await page.evaluate(() => window.__CA_APP__.store.update((s) => {
      s.solved['two-sum'] = { at: Date.now(), lang: 'js', attempts: 1, seconds: 60, xp: 30 };
      s.xpLog.push({ at: Date.now(), xp: 30, id: 'two-sum' });
      s.achievements['first-solve'] = Date.now();
    }));
    await expect(xpText(page)).toHaveText('30 XP');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-btn').click()]);
    const file = info.outputPath('backup.json');
    await dl.saveAs(file);
    expect(dl.suggestedFilename()).toMatch(/^code-arsenal-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).solved['two-sum'].xp).toBe(30);

    // wipe through the reset dialog
    await page.getByTestId('reset-all').click();
    await page.getByTestId('confirm-ok').click();
    await expect(xpText(page)).toHaveText('0 XP');

    await page.getByTestId('import-input').setInputFiles(file);
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('data-msg')).toHaveText('Backup imported.');
    await expect(xpText(page)).toHaveText('30 XP');
    await expect(page.getByTestId('ach-first-solve')).toHaveClass(/earned/);
  });

  test('importing garbage is rejected and changes nothing', async ({ page }, info) => {
    await openApp(page, '#/progress');
    const bad = info.outputPath('bad.json');
    fs.mkdirSync(path.dirname(bad), { recursive: true });
    fs.writeFileSync(bad, '{"hello": "world"}');
    await page.getByTestId('import-input').setInputFiles(bad);
    await expect(page.getByTestId('data-msg')).toHaveText('That file is not a Code Arsenal backup.');
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    await expect(xpText(page)).toHaveText('0 XP');
  });

  test('reset dialog: Escape closes it and focus returns; confirming erases', async ({ page }) => {
    await openApp(page, '#/progress');
    await page.evaluate(() => window.__CA_APP__.store.update((s) => {
      s.solved['two-sum'] = { at: Date.now(), lang: 'js', attempts: 1, seconds: 60, xp: 30 };
    }));
    await expect(xpText(page)).toHaveText('30 XP');
    const btn = page.getByTestId('reset-all');
    await btn.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByTestId('confirm-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('aria-labelledby', 'dlg-t');
    await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(btn).toBeFocused();
    await expect(xpText(page)).toHaveText('30 XP');
    // focus is trapped inside while open
    await btn.click();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('dialog'))).toBe(true);
    await page.getByTestId('confirm-ok').click();
    await expect(xpText(page)).toHaveText('0 XP');
    expect(Object.keys((await state(page)).solved)).toEqual([]);
  });
});

/* ------------------------------ reference solutions ------------------------------ */
test.describe('every reference solution passes through the real UI (JavaScript)', () => {
  for (const id of IDS) {
    test('js: ' + id, async ({ page }) => {
      const errors = await watch(page);
      await solveViaUI(page, id, 'js');
      await expect(page.getByTestId('result-summary')).toHaveText(
        new RegExp('^' + BY_ID[id].tests.length + ' of ' + BY_ID[id].tests.length + ' tests passed')
      );
      await expect(page.locator('[data-testid=test-row][data-passed=false]')).toHaveCount(0);
      await expect(page.getByTestId('xp-awarded')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

// Pyodide is fetched from a public CDN, so these need network access and are allowed one retry.
const PY_IDS = ['two-sum', 'coin-change', 'softmax', 'parse-query-string', 'inner-join', 'caesar-cipher', 'paginate'];
test.describe('Python reference solutions through the real UI', () => {
  test.describe.configure({ retries: 1, timeout: 150000 });
  const picks = PY_IDS.filter((id) => BY_ID[id]);
  const fallback = problems.filter((p) => !picks.includes(p.id));
  // always cover at least 6 problems spanning tracks
  const final = picks.length >= 6 ? picks : picks.concat(fallback.slice(0, 6 - picks.length).map((p) => p.id));
  for (const id of final) {
    test('py: ' + id, async ({ page }) => {
      await solveViaUI(page, id, 'py', 120000);
      await expect(page.getByTestId('solve-box')).toBeVisible();
      await expect(page.locator('[data-testid=test-row][data-passed=false]')).toHaveCount(0);
      expect((await state(page)).solved[id].lang).toBe('py');
    });
  }

  test('py: a wrong answer fails with visible results', async ({ page }) => {
    await openApp(page, '#/challenge/two-sum');
    await chooseLang(page, 'py');
    await setCode(page, 'def two_sum(nums, target):\n    return [0, 0]\n');
    await page.getByTestId('submit-btn').click();
    await expect(page.getByTestId('results')).toHaveAttribute('data-status', 'done', { timeout: 120000 });
    await expect(page.getByTestId('results')).toHaveAttribute('data-all-passed', 'false');
    expect(await page.locator('[data-testid=test-row][data-passed=false]').count()).toBeGreaterThan(0);
    await expect(xpText(page)).toHaveText('0 XP');
  });
});
