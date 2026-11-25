# Architecture contract (build spec)

Static site, no build step, classic `<script>` tags only (no ES modules, no inline scripts, no inline
event handlers, no `eval` outside `sandbox.html`). Globals: `CAJudge`, `CACore`, `CA_PROBLEMS_REG`.

## Files and owners
| File | Purpose |
|---|---|
| `index.html`, `css/landing.css`, `js/landing.js` | Landing page (Persuade) |
| `app.html`, `css/tokens.css`, `css/app.css`, `js/icons.js`, `js/app.js` | App shell, views, router |
| `js/terminal.js`, `js/mentor.js` | `CATerminal`, `CAMentor` (pure logic, no DOM) |
| `sandbox.html`, `js/sandbox.js`, `js/runner.js` | Isolated code execution; `CARunner` |
| `vendor/` | Self-hosted CodeMirror 5, fonts (no third-party requests from app pages) |
| `tests/e2e/*.spec.js`, `playwright.config.js` | Browser tests |
| `js/judge.js`, `js/core.js`, `js/problems/*.js`, `scripts/verify-problems.js`, `tests/unit` | DONE, do not edit |

## Shared APIs
- `CACore`: see `js/core.js` (esc, fmt, buildProblems, stats, applySubmission, createStore, dailyProblem, CATEGORIES, DIFFICULTIES, ACHIEVEMENTS, levelProgress ...).
- `CARunner.run({ lang:'js'|'py', code, problem, mode:'run'|'submit', onStatus(msg) }) -> Promise<result>` where `result` is the `CAJudge.scoreResults` shape plus `status` in `done|compile_error|error|timeout|unavailable`. `mode:'run'` executes only tests with `hidden !== true`.
- `CAIcons.svg(name, {size, label})` returns an SVG string; names: see `js/icons.js`.
- `CATerminal.create({problems, store, core, navigate}) -> { exec(line) -> {lines:[{text,kind}], clear?:bool, navigate?:string} }`.
- `CAMentor.reply(message, ctx) -> {text}` (`ctx = {problem, code, lang, stats, problems}`), text uses `CACore.fmt` markup only.
- Hash routes: `#/dashboard`, `#/challenges`, `#/challenge/<id>`, `#/progress`, `#/terminal`, `#/mentor`. Unknown route -> dashboard. Ids validated against the catalogue.

## Security rules (non-negotiable)
1. All dynamic strings go through `CACore.esc`/`fmt` or `textContent`. Never concatenate untrusted data into HTML.
2. No inline `<script>`, `on*=` attributes or `javascript:` URLs. Use `addEventListener`/event delegation.
3. App CSP (meta): `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`.
4. User code runs ONLY inside `sandbox.html` (iframe `sandbox="allow-scripts"`, opaque origin) whose own CSP permits `unsafe-eval`, blob workers and the Pyodide CDN, and nothing else.
5. External links: `rel="noopener noreferrer"`. Referrer policy `no-referrer`.

## Design
Read `DESIGN.md` and `PRODUCT.md`. Tokens live in `css/tokens.css` (light + dark + `[data-theme]`), no violet, no gradient text, no emoji icons, no side-border accents, no glass blur, no matrix rain. Operate mode for the app: dense, scannable, keyboard friendly, visible focus rings, `prefers-reduced-motion` honoured, 44px touch targets on mobile, no horizontal scroll at 320px.
