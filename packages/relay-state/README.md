# @relay-state/store

A reusable TypeScript global state manager for Electron with **synchronous authoritative** main/renderer reads and writes, plus a React hook backed by a revisioned renderer cache.

> **Important:** Renderer authoritative operations use blocking Electron IPC (`sendSync`). This is a deliberate solution to a synchronous-access exercise; it is not a recommended default for high-frequency or large-state applications.

The library exposes independent entry points: `@relay-state/store/core`, `@relay-state/store/electron/main`, `@relay-state/store/electron/preload`, `@relay-state/store/renderer`, and `@relay-state/store/react`.

For complete integration examples, consistency guarantees, security boundaries, and testing instructions, see the root repository [`README.md`](../../README.md) and [`docs/`](../../docs/). Package publication is not yet verified.
