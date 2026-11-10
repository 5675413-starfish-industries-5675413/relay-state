# Security boundaries and disclosure

Relay assumes renderer processes are potentially compromised and therefore never exposes raw `ipcRenderer`, arbitrary IPC channels, Electron event objects, Node modules or filesystem privileges.

## Privileged boundary

- `createSyncBridge` exposes only fixed read, dispatch and notification methods.
- `attachElectronStore` *requires* an application-supplied sender authorization callback and an approved-recipient callback.
- Both reads and writes are subject to sender authorization; broadcasts only go to approved windows.
- The demo checks registered BrowserWindow membership, the main frame, and an expected development or production origin/path.
- The demo enables `sandbox`, `contextIsolation`, `webSecurity`, disables renderer Node integration/webviews, rejects new windows and unexpected navigation, and refuses browser permission prompts.
- The packaged demo loads a dedicated `relayapp://app` origin and sends a restrictive production CSP. The development server is a local trusted development-only origin.
- Runtime validation enforces an application action schema and plain-data payload/depth limits.

## Trust limitations

Any **authorized** renderer can read the entire shared snapshot and initiate actions permitted by the application. Relay is **not** field-level authorization, user authentication, a process sandbox, a secrets vault, or a persistence permission system. Never put renderer-inaccessible secrets in shared state. An XSS in an authorized renderer can invoke its allowed methods.

## Synchronous IPC risk

`sendSync` blocks the caller. Main must not wait for renderer responses, dialogs, network calls or disk I/O in the request path. Unrelated work stalling main can still stall the renderer. This is a deliberate exercise-specific tradeoff, not a general security/performance recommendation.

## Reporting

For vulnerabilities in a published fork, use that repository's private security advisory/reporting channel. Do not post exploitable details in a public issue.

## Hardening verification

The registered-window authorization policy is tested against forged/unregistered
senders, subframes, origin/path changes and destroyed windows. Electron E2E also
attempts real synchronous IPC from an unregistered same-origin BrowserWindow.
These tests deliberately do not add any authorization bypass to the library.
The independent barrier is enabled only when `RELAY_E2E=1` **and** `app.isPackaged` is false, matches the unique
barrier test action, and is released by a separate Playwright process. The
`__relayE2E` inspection hook exists in Electron main **only** in explicit
unpackaged test mode; it is never exposed through preload or the renderer API. Do not set this
flag in released applications.
