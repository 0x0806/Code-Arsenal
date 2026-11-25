# Code Arsenal

Browser-based programming practice where the tests actually run. Write a solution in **JavaScript or
Python**, run it against visible tests, then submit it against hidden ones. XP, levels, streaks and
achievements are earned only when every test passes. No accounts, no server: progress stays on your
device.

An educational project by [0X0806](https://github.com/0x0806).

## What is in it
- **41 challenges, 8 tracks:** algorithms, data structures, dynamic programming, machine learning,
  web development, databases, cybersecurity, mobile development. Each has examples, constraints,
  three tiers of hints, hidden tests and an editorial that unlocks after you solve it.
- **Real judging:** JavaScript runs in a Web Worker, Python in Pyodide, both inside an isolated
  sandbox iframe with a hard time limit.
- **Workspace:** CodeMirror editor, per-language drafts, public and hidden tests, console capture.
- **Progress:** levels, ranks, streaks, 14 achievements, backup export and import.
- **Terminal and mentor:** a real command line over your data, and an offline rule-based tutor
  (it is not an AI model, and says so).

## Run it
```bash
npm install
npm run serve          # http://127.0.0.1:4173  (landing page), app.html for the app
```
Any static file server works. There is no build step.

## Test it
```bash
npm run verify         # every reference solution passes its own tests, in JS and Python
npm run test:unit      # core logic, judge, terminal, mentor, runner security
npm run test:e2e       # Playwright: functional, accessibility, responsive, security
```

## Layout
| Path | Purpose |
|---|---|
| `index.html` | Landing page |
| `app.html` | The app (hash routes: dashboard, challenges, challenge/<id>, progress, terminal, mentor) |
| `sandbox.html`, `js/sandbox.js`, `js/runner.js`, `js/judge.js` | Isolated code execution and scoring |
| `js/core.js` | XP, levels, streaks, achievements, validated persistence |
| `js/problems/` | The challenge bank, with reference solutions |
| `vendor/` | Self-hosted CodeMirror and fonts (no third-party requests from app pages) |
| `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`, `SECURITY.md` | Product, design, build contract, threat model |

## Adding a challenge
Add an entry to a file in `js/problems/` with tests and a reference solution in both languages, then
run `npm run verify`. A challenge without a passing reference solution fails CI.

## Security
See [SECURITY.md](SECURITY.md). Pyodide is the only third-party code, loaded from a pinned jsDelivr
URL inside the sandbox the first time you run Python.
