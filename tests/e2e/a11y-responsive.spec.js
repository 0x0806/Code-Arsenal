// Accessibility (axe), responsive layout, reduced motion and forced-colors checks.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default || require('@axe-core/playwright');
const { problems } = require('../unit/load.js');

const VIEWS = [
  { name: 'landing', url: '/index.html', ready: 'h1' },
  { name: 'dashboard', url: '/app.html?e2e=1#/dashboard', ready: 'main h1' },
  { name: 'challenges', url: '/app.html?e2e=1#/challenges', ready: '[data-testid=problem-table]' },
  { name: 'challenge', url: '/app.html?e2e=1#/challenge/two-sum', ready: 'main h1' },
  { name: 'progress', url: '/app.html?e2e=1#/progress', ready: '[data-testid=ach-first-solve]' },
  { name: 'terminal', url: '/app.html?e2e=1#/terminal', ready: '[data-testid=terminal-input]' },
  { name: 'mentor', url: '/app.html?e2e=1#/mentor', ready: '[data-testid=mentor-reply]' }
];
const APP_VIEWS = VIEWS.filter((v) => v.name !== 'landing');
const WIDTHS = [320, 390, 768, 1024, 1440];
const TAGS = ['wcag2a', 'wcag2aa', 'best-practice'];

async function load(page, v) {
  await page.goto(v.url);
  await expect(page.locator(v.ready).first()).toBeVisible();
  if (v.name === 'challenge') await expect(page.locator('.CodeMirror')).toHaveCount(1);
  // let one-shot entrance animations finish so contrast is measured on the settled state
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity), null, { timeout: 8000 });
}
async function axe(page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((x) => x.id + ': ' + x.help + ' -> ' + x.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | '));
}

/* ------------------------------ axe ------------------------------ */
test.describe('axe: zero violations', () => {
  for (const scheme of ['light', 'dark']) {
    for (const v of VIEWS) {
      test(v.name + ' / ' + scheme, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await load(page, v);
        expect(await axe(page)).toEqual([]);
      });
    }
  }

  for (const scheme of ['light', 'dark']) {
    test('challenge with failed results and with solve box / ' + scheme, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await load(page, VIEWS[3]);
      await page.getByTestId('run-btn').click();
      await expect(page.getByTestId('result-summary')).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.getByTestId('tab-hints').click();
      await page.getByTestId('reveal-hint').click();
      expect(await axe(page)).toEqual([]);
      await page.getByTestId('editor-input').focus();
      await page.keyboard.press('Control+A');
      await page.keyboard.insertText(problems.find((p) => p.id === 'two-sum').solutions.js);
      await page.getByTestId('submit-btn').click();
      await expect(page.getByTestId('solve-box')).toBeVisible();
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 8000 });
      expect(await axe(page)).toEqual([]);
    });

    test('confirm dialog and empty search state / ' + scheme, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await load(page, VIEWS[2]);
      await page.getByTestId('search').fill('zzzqqq');
      await expect(page.getByTestId('empty-results')).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto('/app.html?e2e=1#/progress');
      await page.getByTestId('reset-all').click();
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });

    test('progress with earned achievements / ' + scheme, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/app.html?e2e=1#/progress');
      await page.evaluate(() => window.__CA_APP__.store.update((s) => {
        s.solved['two-sum'] = { at: Date.now(), lang: 'js', attempts: 1, seconds: 60, xp: 30 };
        s.xpLog.push({ at: Date.now(), xp: 30, id: 'two-sum' });
        s.achievements['first-solve'] = Date.now();
        s.streak = { current: 1, best: 1, last: new Date().toISOString().slice(0, 10) };
      }));
      await page.goto('/app.html?e2e=1#/dashboard');
      await expect(page.locator('main h1')).toHaveText('Dashboard');
      expect(await axe(page)).toEqual([]);
      await page.goto('/app.html?e2e=1#/progress');
      await expect(page.getByTestId('ach-first-solve')).toHaveClass(/earned/);
      expect(await axe(page)).toEqual([]);
    });
  }
});

/* ------------------------------ titles ------------------------------ */
test('every view has its own page title', async ({ page }) => {
  const titles = [];
  for (const v of VIEWS) {
    await page.goto(v.url);
    await expect(page.locator(v.ready).first()).toBeVisible();
    titles.push(await page.title());
  }
  expect(titles.every((t) => t.trim().length > 0)).toBe(true);
  expect(new Set(titles).size).toBe(VIEWS.length);
});

/* ------------------------------ responsive ------------------------------ */
test.describe('responsive layout', () => {
  for (const w of WIDTHS) {
    test.describe('width ' + w, () => {
      test.use({ viewport: { width: w, height: 800 } });

      for (const v of VIEWS) {
        test(v.name + ': no horizontal scroll', async ({ page }) => {
          await load(page, v);
          const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
          expect(m.sw, 'documentElement overflows').toBeLessThanOrEqual(m.cw);
          expect(m.bw, 'body overflows').toBeLessThanOrEqual(m.cw);
          // nothing is pushed beyond the right edge of the viewport (ignoring scroll containers' contents)
          const off = await page.evaluate(() => {
            const out = [];
            const scrollers = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
            document.querySelectorAll('body *').forEach((e) => {
              const r = e.getBoundingClientRect();
              if (r.width && r.height && r.right > document.documentElement.clientWidth + 1 && !scrollers(e) && getComputedStyle(e).position !== 'fixed') out.push(e.tagName + '.' + e.className);
            });
            return out.slice(0, 5);
          });
          expect(off).toEqual([]);
        });
      }

      if (w <= 768) {
        for (const v of VIEWS) {
          test(v.name + ': interactive targets are at least 44px', async ({ page }) => {
            await load(page, v);
            if (v.name === 'challenge') await page.getByTestId('pane-code').click();
            const small = await page.evaluate(() => {
              const sel = 'a[href], button, input, select, textarea, summary, [role=tab], [role=button]';
              const res = [];
              document.querySelectorAll(sel).forEach((e) => {
                if (e.closest('.CodeMirror') || e.classList.contains('skip') || e.hidden) return;
                const cs = getComputedStyle(e);
                if (cs.visibility === 'hidden' || cs.display === 'none') return;
                if (e.type === 'file' || e.type === 'hidden') return;
                // inline links inside running text are exempt (WCAG 2.5.8)
                if (e.tagName === 'A' && cs.display === 'inline' && e.closest('p, li, dd, dt, h1, h2, h3, h4, td, th, .prose, kbd')) return;
                const r = e.getBoundingClientRect();
                if (!r.width || !r.height) return;
                const textLink = e.tagName === 'A' && /\S/.test(e.textContent);
                if (r.height < 43.5 || (r.width < 43.5 && !textLink)) res.push((e.getAttribute('data-testid') || e.tagName + '.' + e.className + '[' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20) + ']') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
              });
              return res;
            });
            expect(small).toEqual([]);
          });
        }
      }

      for (const v of APP_VIEWS) {
        test(v.name + ': content is not hidden under the sticky header', async ({ page }) => {
          await load(page, v);
          const bad = await page.evaluate(() => {
            const hdr = document.getElementById('topbar').getBoundingClientRect();
            const out = [];
            document.querySelectorAll('#view *, #nav *').forEach((e) => {
              const r = e.getBoundingClientRect();
              const cs = getComputedStyle(e);
              if (!r.width || !r.height || cs.position === 'fixed' || cs.position === 'sticky' || cs.visibility === 'hidden') return;
              // content scrolled out of an inner scroll container is clipped, not overlapping
              for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) {
                const o = getComputedStyle(q);
                if (/auto|scroll|hidden/.test(o.overflowY)) { const qr = q.getBoundingClientRect(); const cy = r.top + r.height / 2; if (cy < qr.top || cy > qr.bottom) return; }
              }
              if (r.top < hdr.bottom - 1 && r.bottom > hdr.top + 1 && r.bottom > hdr.top && window.scrollY === 0 && getComputedStyle(document.getElementById('topbar')).position !== 'static') {
                // only elements actually painted at the header's position count
                const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
                if (hit && !document.getElementById('topbar').contains(hit) && hit !== e && !e.contains(hit)) return;
                if (document.getElementById('topbar').contains(hit)) out.push(e.tagName + '.' + e.className);
              }
            });
            return out.slice(0, 5);
          });
          expect(bad).toEqual([]);
        });
      }

      test('focused rows scroll clear of the sticky header', async ({ page }) => {
        await load(page, VIEWS[2]);
        const last = page.locator('.t-title a').last();
        await last.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(last).toBeFocused();
        const [hb, top] = await page.evaluate(() => {
          const h = document.getElementById('topbar');
          const e = document.activeElement;
          return [getComputedStyle(h).position === 'static' ? 0 : h.getBoundingClientRect().bottom, e.getBoundingClientRect().top];
        });
        expect(top).toBeGreaterThanOrEqual(hb - 1);
      });
    });
  }
});

/* ------------------------------ reduced motion ------------------------------ */
test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const v of VIEWS) {
    test(v.name + ': nothing is animating', async ({ page }) => {
      await page.goto(v.url);
      await expect(page.locator(v.ready).first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length), { timeout: 5000 }).toBe(0);
      const transitions = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('body *').forEach((e) => {
          const cs = getComputedStyle(e);
          const dur = cs.transitionDuration.split(',').map((s) => parseFloat(s) * (s.trim().endsWith('ms') ? 1 : 1000));
          if (dur.some((d) => d > 50)) bad.push(e.tagName + '.' + e.className);
        });
        return bad.slice(0, 5);
      });
      expect(transitions).toEqual([]);
    });
  }
  test('solving shows the result without running animations', async ({ page }) => {
    await page.goto('/app.html?e2e=1#/challenge/two-sum');
    await expect(page.locator('.CodeMirror')).toBeVisible();
    await page.getByTestId('editor-input').focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(problems.find((p) => p.id === 'two-sum').solutions.js);
    await page.getByTestId('submit-btn').click();
    await expect(page.getByTestId('solve-box')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).length)).toBe(0);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length), { timeout: 5000 }).toBe(0);
  });
});

/* ------------------------------ forced colors ------------------------------ */
test.describe('forced-colors smoke', () => {
  test.use({ colorScheme: 'dark' });
  for (const v of VIEWS) {
    test(v.name + ': renders, has no overflow, and controls stay distinguishable', async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      await load(page, v);
      const m = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(m).toBe(true);
      await expect(page.locator('h1').first()).toBeVisible();
      // every button has a visible border or outline so it is not just text on text
      const flat = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('button:not([hidden]), .btn').forEach((b) => {
          const r = b.getBoundingClientRect();
          if (!r.width || !r.height || b.closest('.CodeMirror')) return;
          const cs = getComputedStyle(b);
          const border = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
          const outline = parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none';
          if (!border && !outline && cs.backgroundColor === 'rgba(0, 0, 0, 0)') out.push(b.getAttribute('data-testid') || b.textContent.trim().slice(0, 20));
        });
        return out.slice(0, 8);
      });
      // report, but only fail on the primary action buttons which must always be discernible
      expect(flat.filter((n) => /run-btn|submit-btn|export-btn|reset-all/.test(n))).toEqual([]);
    });
  }
});
