# Security

Code Arsenal is an educational project. It has no server, no accounts and collects nothing.
Progress is kept in your browser's `localStorage`.

## Threat model and controls
| Risk | Control |
|---|---|
| Learner code attacking the page or reading progress | Code runs in a Web Worker inside a `sandbox="allow-scripts"` iframe with an opaque origin and its own CSP (`sandbox.html`). It cannot reach the app's DOM, storage or cookies. |
| Infinite loops / hangs | The parent enforces a hard timeout and destroys the sandbox. |
| Cheating by forging results | Results are accepted only from the sandbox window with the matching run id and nonce; hidden tests never leave the worker in readable form. |
| XSS | Every dynamic string is escaped (`CACore.esc`/`fmt`) or set with `textContent`. No inline scripts or handlers; strict CSP on every page. |
| Tampered `localStorage` / imported backups | State is rebuilt field by field (`sanitizeState`): known problem ids only, types and ranges clamped, prototype keys ignored. |
| Third-party code | App pages load nothing from third parties. CodeMirror and fonts are self-hosted. Only the sandbox loads Pyodide from jsDelivr (pinned version). |
| Clickjacking / referrer leaks | `rel="noopener noreferrer"`, `referrer: no-referrer`. Note: GitHub Pages cannot send `frame-ancestors`; deploy behind a host that can for full coverage. |

## Reporting
Open a private security advisory on the GitHub repository or an issue without exploit details.
