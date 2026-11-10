# Architecture and dependency boundaries

## Components

```text
Application domain: TaskState + TaskAction + parseTaskAction + taskReducer
            |                                       |
            v                                       v
   createMainStore() ------------------------> attachElectronStore()
       |                                          | 
       | main direct sync get/dispatch             | sender-authorized sync IPC
       |                                          v
       |                                    sandboxed preload
       |                                          |
       |                                restricted contextBridge
       |                                          v
       |                                   createRendererStore()
       |                                          |
       +---- async revisioned broadcasts ---------+
                                                  |
                                         createStoreHooks()
                                                  |
                                         React task components
```

Main is the only authority. Multiple renderer stores maintain immutable caches. A renderer `getState()`/`refresh()` performs an actual blocking read from main; it does not pretend its local cached snapshot is globally current. Renderer `dispatch()` returns the main-generated revision after commit or no-op.

## Ownership and boundaries

| Directory | Imports allowed | Responsibility |
|---|---|---|
| `core` | TypeScript standard APIs | Validate/own state, reduce, commit, notify |
| `electron/main` | Electron, core, protocol | Sender authorization, synchronous handlers, broadcasts |
| `electron/preload` | Electron, protocol | Fixed synchronous IPC facade |
| `renderer` | Core contracts, protocol types | Local snapshot, revision gate, lifecycle |
| `react` | React, renderer contracts | Subscribe to cached store, expose hook |
| `apps/relay-tasks/src/shared` | App-only | Domain actions, reducer, validation |
| `apps/relay-tasks/src/main` | Library entrypoints and Electron | Windows, security, menu, instantiation |
| `apps/relay-tasks/src/renderer` | Library entrypoints and React | Product UI; no direct IPC |

The library contains no task-specific code, persistence, global process discovery, or permissive authorization defaults. The app contains no bespoke synchronization engine.

## Security and packaging

Preload is emitted as a CommonJS bundle because sandboxed Electron preload scripts do not support ESM imports. `electron-vite` is configured to bundle dependencies in preload. Production pages use a custom `relayapp://app` scheme, restricted CSP and sender allowlist. See `SECURITY.md`.

## Test-only instrumentation

When `RELAY_E2E=1`, main registers a non-renderer-accessible inspection helper for Playwright's main-process evaluation. The optional barrier waits for a file written by the **separate Node test runner**, not a callback on the blocked Electron main loop. Neither appears as a public library API.
