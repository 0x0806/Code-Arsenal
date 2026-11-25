// End-to-end tests for the landing page (index.html).
const { test, expect } = require('@playwright/test');
const { problems, core } = require('../unit/load.js');

const TWO = problems.find((p) => p.id === 'two-sum');

async function watch(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  return errors;
}

test.describe('landing page', () => {
  test('loads with zero console errors and CSP violations, one h1, title and description', async ({ page }) => {
    const errors = await watch(page);
    await page.goto('/index.html');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle('Code Arsenal');
    await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /.{40,}/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.__csp)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('numbers on the page equal the catalogue', async ({ page }) => {
    await page.goto('/index.html');
    expect(problems.length).toBe(41);
    expect(core.CATEGORIES.length).toBe(8);
    const facts = page.locator('.facts');
    await expect(facts.locator('[data-bind=problems]')).toHaveText(String(problems.length));
    await expect(facts.locator('[data-bind=tracks]')).toHaveText(String(core.CATEGORIES.length));
    await expect(facts.locator('[data-bind=langs]')).toHaveText('JavaScript, Python');
    await expect(page.locator('#tracks-h')).toContainText(problems.length + ' problems');
    await expect(page.locator('#tracks-h')).toContainText('Eight tracks');
    // per-track counts and names
    const items = page.locator('#track-list > li');
    await expect(items).toHaveCount(core.CATEGORIES.length);
    for (let i = 0; i < core.CATEGORIES.length; i++) {
      const c = core.CATEGORIES[i];
      await expect(items.nth(i).locator('.tn')).toHaveText(String(problems.filter((p) => p.category === c.id).length));
      await expect(items.nth(i).locator('h3')).toHaveText(c.name);
    }
    // difficulty XP and achievements
    for (const d of core.DIFFICULTIES) await expect(page.locator('#xp-list')).toContainText(d.label + d.xp + ' XP');
    await expect(page.locator('[data-bind=ach-count]')).toHaveText(String(core.ACHIEVEMENTS.length));
    for (const a of core.ACHIEVEMENTS) await expect(page.locator('#ach-list')).toContainText(a.name);
    // ranks
    await expect(page.locator('#stairs > li')).toHaveCount(core.RANKS.length);
    await expect(page.locator('[data-bind=demo-xp]')).toHaveText(core.xpForLevel(12).toLocaleString('en-US'));
    // miniature uses the real Two Sum tests and XP
    await expect(page.locator('#ws-tests > li')).toHaveCount(TWO.tests.length);
    await expect(page.locator('#ws-xp')).toHaveText('+' + TWO.xp + ' XP');
    await expect(page.locator('#result-verdict')).toHaveText('5 of ' + TWO.tests.length + ' passed');
  });

  test('the miniature ends in an all-passing state', async ({ page }) => {
    await page.goto('/index.html');
    const n = TWO.tests.length;
    await expect(page.locator('#ws-count')).toHaveText(n + ' of ' + n + ' passing', { timeout: 15000 });
    await expect(page.locator('#ws-tests li[data-s=ok]')).toHaveCount(n);
  });

  test('call-to-action links reach app routes and the app loads', async ({ page }) => {
    await page.goto('/index.html');
    const hrefs = await page.locator('a[href^="app.html"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    for (const h of hrefs) expect(h).toMatch(/^app\.html#\/(dashboard|challenges)$/);

    await page.locator('.hero a', { hasText: 'Open the arsenal' }).click();
    await expect(page).toHaveURL(/app\.html#\/dashboard$/);
    await expect(page.locator('main h1')).toHaveText('Dashboard');

    await page.goto('/index.html');
    await page.locator('.hero a', { hasText: 'Browse challenges' }).click();
    await expect(page).toHaveURL(/app\.html#\/challenges$/);
    await expect(page.locator('main h1')).toHaveText('Challenges');
    await expect(page.getByTestId('count')).toHaveText(/Showing 41 of 41/);
  });

  test('in-page nav anchors point at real sections and the external link is safe', async ({ page }) => {
    await page.goto('/index.html');
    const hrefs = await page.locator('.top-nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBe(4);
    for (const h of hrefs) await expect(page.locator(h)).toHaveCount(1);
    const ext = page.locator('a[href^="https://"]');
    await expect(ext).toHaveCount(1);
    await expect(ext).toHaveAttribute('rel', /noopener/);
    await expect(ext).toHaveAttribute('rel', /noreferrer/);
  });

  test('skip link reaches main content', async ({ page }) => {
    await page.goto('/index.html');
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('reduced motion shows the final static state with no running animation', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    const n = TWO.tests.length;
    // final state immediately, no staged fail -> pass sequence
    await expect(page.locator('#ws-count')).toHaveText(n + ' of ' + n + ' passing');
    await expect(page.locator('#ws-tests li[data-s=fail]')).toHaveCount(0);
    await expect(page.locator('#ws')).not.toHaveAttribute('data-run', /.*/);
    await expect(page.locator('#stairs')).toHaveClass(/\bin\b/);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).length)).toBe(0);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
    await ctx.close();
  });

  test('works with JavaScript disabled: readable fallback content', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    await expect(page.locator('h1')).toHaveText(/Practice programming where the tests actually run/);
    await expect(page.locator('.facts')).toContainText('41');
    await expect(page.locator('.facts')).toContainText('8');
    await expect(page.locator('.facts')).toContainText('JavaScript, Python');
    await expect(page.locator('#track-list > li')).toHaveCount(8);
    await expect(page.locator('#ws-count')).toHaveText('6 of 6 passing');
    await expect(page.locator('#stairs > li')).toHaveCount(9);
    await expect(page.locator('#stairs')).toBeVisible();
    await expect(page.locator('#ach-list')).toContainText('First Blood');
    await expect(page.locator('a[href="app.html#/dashboard"]').first()).toBeVisible();
    // every hero element is visible, not hidden behind a js-only entrance state
    for (const sel of ['.hero-copy', '.hero-ui', '#judging', '#tracks', '#privacy', '#progress']) await expect(page.locator(sel)).toBeVisible();
    // the CSS entrance animation (if any) settles at full opacity
    await expect.poll(() => page.locator('.hero-copy').evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
    await ctx.close();
  });

  test('static fallback numbers match the catalogue (so no-JS visitors see true counts)', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    await expect(page.locator('.facts [data-bind=problems]')).toHaveText(String(problems.length));
    await expect(page.locator('.facts [data-bind=tracks]')).toHaveText(String(core.CATEGORIES.length));
    const counts = await page.locator('#track-list .tn').allTextContents();
    expect(counts.map(Number)).toEqual(core.CATEGORIES.map((c) => problems.filter((p) => p.category === c.id).length));
    await expect(page.locator('[data-bind=ach-count]')).toHaveText(String(core.ACHIEVEMENTS.length));
    await ctx.close();
  });
});
