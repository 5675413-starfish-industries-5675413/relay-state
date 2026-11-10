# Relay State

**A reusable TypeScript global state manager for Electron with synchronous authoritative operations and reactive React hooks.**

[![CI](https://github.com/5675413-starfish-industries-5675413/relay-state/actions/workflows/ci.yml/badge.svg)](https://github.com/5675413-starfish-industries-5675413/relay-state/actions/workflows/ci.yml)

Relay uses one authoritative main-process reducer. Main calls it directly. Renderer code calls `dispatch()` and `getState()` synchronously through a restricted Electron preload bridge. React renders from a revisioned local cache, using asynchronous notifications for updates made elsewhere.

> **Important:** The synchronous transport uses Electron `ipcRenderer.sendSync`. It blocks the calling renderer until main replies. It is intentionally chosen to demonstrate a literal synchronous cross-process contract, **not recommended as a default for all Electron apps**. Use Relay only for bounded state and infrequent operations; never call authoritative operations during React rendering or high-frequency event loops.

## Contents

- **`packages/relay-state`** — framework-independent core, Electron adapter, renderer store and React hook
- **`apps/relay-tasks`** — functional desktop task workspace, compact companion and native menu updates
- **`tests/consumer`** — unrelated preferences-domain consumer installed from a packed library archive
- **`docs`** — detailed architecture, consistency, integration, verification and reviewer demonstration

## Review the reusable implementation

The public API—not the demo app—is the deliverable. Start with the [main store](packages/relay-state/src/core/create-main-store.ts), [Electron main adapter](packages/relay-state/src/electron/main/attach-electron-store.ts), [restricted preload bridge](packages/relay-state/src/electron/preload/create-sync-bridge.ts), [renderer store](packages/relay-state/src/renderer/create-renderer-store.ts), and [React hook](packages/relay-state/src/react/create-store-hooks.ts). Then open [Relay Tasks](apps/relay-tasks): two genuinely functioning windows plus native-menu mutations that consume the library.

**Verified baseline:** commit [`076b1ba`](https://github.com/5675413-starfish-industries-5675413/relay-state/commit/076b1ba) passed GitHub Actions (23 unit tests, 7 built-Electron E2E tests, typecheck, lint, build, and independent packaged React/TypeScript consumers). The machine-specific manual demo, latency measurements and dependency triage are separate final checks—not claims already established by CI.

## Quick start

Prerequisite: Node.js 24 and a platform supported by Electron. Dependencies are installed from the committed lockfile.

```bash
npm ci                  # install exactly the locked dependency graph
npm run dev             # builds the library and launches Relay Tasks
npm run build           # production bundles (not an installer)
npm run typecheck
npm test
npm run test:consumer
npm run test:e2e        # Linux desktop requires DISPLAY; e.g. xvfb-run
npm run benchmark:ipc   # built app, real sync IPC round trips; saves local JSON
npm run audit:report    # read-only npm advisory reports; does not modify dependencies
```

The committed `package-lock.json` is used by CI with `npm ci`. `@relay-state/store` is a provisional workspace package name; npm publication requires verifying name and scope ownership.

## Application

Workspace: add, complete, delete and filter tasks. Companion: quick capture and completion. Native **Tasks → Add example task** calls the main store directly. Both renderers share the same authority; no component imports `ipcRenderer`.

The workspace Diagnostics panel offers an authoritative read and a synchronous dispatch/read check. The companion has a manual authoritative refresh for testing stale caches. All state is deliberately reset when the application restarts; persistence is not included in v0.1.

**Manual demo:** after `npm run build`, launch the built desktop app with `npm run preview -w @relay-state/tasks`. Add in Workspace, complete in Companion, use macOS **Tasks → Add example task** (main-originated dispatch), then run both Diagnostics controls. The [final reviewer checklist](docs/final-review.md) gives the full 2–3 minute walkthrough, benchmarking procedure, and dependency audit triage.

## Library integration (minimal)

**Main process**

```ts
import { createMainStore } from '@relay-state/store/core';
import { attachElectronStore } from '@relay-state/store/electron/main';

const store = createMainStore({
  initialState: { count: 0 },
  parseAction: (value: unknown) => {
    if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'increment')
      throw new TypeError('Invalid action');
    return { type: 'increment' as const };
  },
  reducer: (state, action) => action.type === 'increment'
    ? { count: state.count + 1 } : state,
});

const detach = attachElectronStore({
  namespace: 'my-app', store,
  authorize: (event) => isApprovedMainFrame(event),
  getRecipients: () => approvedWebContents(),
});
```

`isApprovedMainFrame` and `approvedWebContents` are application-defined policies; Relay intentionally has no permissive default. See `apps/relay-tasks/src/main/security.ts` for the actual demo policy.

**Preload**

```ts
import { contextBridge } from 'electron';
import { createSyncBridge } from '@relay-state/store/electron/preload';
contextBridge.exposeInMainWorld('relayState', createSyncBridge('my-app'));
```

**Renderer**

```ts
import { createRendererStore } from '@relay-state/store/renderer';
import { createStoreHooks } from '@relay-state/store/react';

const store = createRendererStore({ bridge: window.relayState });
store.initialize(); // synchronous authoritative read; call before mounting React
const { useStoreState } = createStoreHooks(store);

function Counter() {
  const count = useStoreState(state => state.count); // cached, nonblocking React read
  return <button onClick={() => store.dispatch({ type: 'increment' })}>{count}</button>;
}
```

For the exact typed implementation, consult Relay Tasks and `docs/integration.md`.

## Precise consistency guarantee

| Operation | Guarantee |
|---|---|
| Main `getState()` | Synchronous authoritative read |
| Main `dispatch(action)` | Synchronous validated commit/no-op or rejection |
| Renderer `getState()` | Synchronous main read; accepts response into renderer revision gate |
| Renderer `dispatch(action)` | Blocks until main acknowledges committed/no-op revision or rejects |
| Renderer `getCachedSnapshot()` | Nonblocking local read; may lag main |
| `useStoreState(selector)` | Local cached state with reactive notifications |
| Other windows | Receive broadcasts asynchronously; may render later |
| Conflicting writes | Last committed action wins according to actual main commit order |
| Restart | State resets; no persistence guarantee |

A transport/process failure after main commits can leave the result unknown to the caller. Never automatically retry an uncertain write. Main waiting indefinitely can freeze the calling renderer; an in-renderer JavaScript timeout cannot safely cancel `sendSync`.

## Repository quality gates

1. Core validation, reducer behavior, owned immutable state, no-op and revision tests.
2. Renderer initialization, stale snapshot, sync reply and notification reentrancy tests.
3. Real Electron two-window test and test-only main process observation.
4. A controlled synchronous-operation barrier released by the *independent test controller* (not the blocked main event loop).
5. Production preload with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
6. Independent `npm pack` consumer with an unrelated state domain.

See `docs/verification.md` for the exact automated gates and `docs/final-review.md` for the remaining manual, measured-performance, and security-audit evidence. The current verified implementation is commit `076b1ba` (23 unit tests, 7 Electron E2E tests, full typecheck/lint/build, and external package consumers). Results from the new benchmark and npm audit are intentionally **not** invented in this README.

## Design constraints and limitations

- Supported state is plain JSON-compatible data: finite numbers, strings, booleans, null, dense arrays and plain objects; strict limits apply.
- Store owns a validated, deep-frozen copy of initial and committed state.
- Same-state reference returned from reducer is a no-op; new reference increments revision.
- Subscribers are synchronous, short, nonblocking; they must never wait for renderer replies.
- Renderer subscribers may read the cache, but must not issue nested blocking read/refresh/dispatch operations.
- Full snapshots are used rather than patches. No persistence, CRDT, remote collaboration, automatic retries or optimistic writes.
- This design demonstrates synchronous *authoritative operations*, **not** simultaneous cross-window UI rendering or globally shared memory.

## Documentation

[Architecture](docs/architecture.md) · [Consistency](docs/consistency.md) · [Integration](docs/integration.md) · [Verification](docs/verification.md) · [Security](SECURITY.md) · [Final review](docs/final-review.md)

## License

MIT, subject to confirming the repository owner's preferred attribution. This repository is an implementation and demonstration, not a published npm package or installer. The reproducible CI workflow is the source of current verification status.

## Verification beyond a counter demo

`Relay Tasks` is an actual consuming application with a full workspace, a compact
companion, native-menu task creation, two-way completion, diagnostics, and explicit
synchronous authoritative reads. The core manager and the React hook are exported
from the standalone library; application components do not call Electron IPC.

The verification suite specifically checks **main commits before dispatch returns**,
not just a local optimistic update. The hardening tests add an explicit
main-entered signal to the independent barrier, sender-policy negative tests,
window reload/reopen tests, and an npm-packed external React/TypeScript consumer.
See [Verification](docs/verification.md) for the precise coverage and exclusions.
