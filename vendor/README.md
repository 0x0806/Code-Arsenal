# vendor/

Self-hosted third-party assets so app pages make no third-party requests. Rebuild with `npm ci && scripts/vendor.sh`.

| Asset | Version | License |
|---|---|---|
| CodeMirror 5 (core, javascript + python modes, closebrackets, matchbrackets, comment) | 5.65.16 | MIT (`codemirror/LICENSE`) |
| Bricolage Grotesque 600/700/800, latin woff2 (`@fontsource/bricolage-grotesque`) | 5.3.0 | SIL OFL 1.1 |
| Instrument Sans 400/500/600, latin woff2 (`@fontsource/instrument-sans`) | 5.3.0 | SIL OFL 1.1 |
| JetBrains Mono 400/500, latin woff2 (`@fontsource/jetbrains-mono`) | 5.3.0 | SIL OFL 1.1 |

`codemirror/arsenal.css` is hand-written (theme `arsenal`, uses `css/tokens.css` variables). `fonts/fonts.css` is generated.
Pyodide is NOT vendored: `sandbox.html` loads it from cdn.jsdelivr.net, and only the sandboxed iframe may do so.
