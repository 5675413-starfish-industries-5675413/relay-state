# Relay State

**Synchronous state for Electron. Reactive hooks for React.**

[![CI](https://github.com/5675413-starfish-industries-5675413/relay-state/actions/workflows/ci.yml/badge.svg)](https://github.com/5675413-starfish-industries-5675413/relay-state/actions/workflows/ci.yml)

Relay State is a reusable TypeScript global state manager for Electron. A single authoritative store lives in the **main process**, while renderer processes perform synchronous reads and dispatches through a restricted IPC bridge.

React components consume a revisioned local cache through a reusable hook.

The repository includes **Relay Tasks**, a functional two-window desktop application demonstrating the library beyond a simple counter example.

> **Note:** Relay intentionally uses Electron's synchronous IPC (`sendSync`). It blocks the renderer until main responds. This is suitable for demonstrating a strict synchronous contract with small, infrequent operations—not as a general replacement for asynchronous IPC.

## Features

- **Authoritative state** — One main-process store with validated actions and immutable snapshots.
- **Synchronous operations** — Reads and dispatches return main-generated results and revisions.
- **React hooks** — Subscribe to cached state with `useStoreState(selector)`.
- **Multi-window synchronization** — Asynchronous broadcasts propagate updates; stale revisions are rejected.
- **Restricted IPC** — Sandboxed preload, fixed bridge methods, and application-defined sender authorization.
- **Reusable package** — Separate exports for the core, Electron adapters, renderer store, and React integration.

## Getting Started

Requires Node.js 24 and an Electron-supported desktop operating system.

```bash
git clone https://github.com/5675413-starfish-industries-5675413/relay-state.git
cd relay-state
npm ci
npm run dev
```

To run the built application instead:

```bash
npm run build
npm run preview -w @relay-state/tasks
```

### Try Relay Tasks

1. Add a task in **Workspace** and watch it appear in **Companion**.
2. Complete it in Companion and observe Workspace update.
3. Choose **Tasks → Add example task** from the native application menu.
4. Use **Sync dispatch check** in Workspace Diagnostics to verify an immediate authoritative read after a committed dispatch.
5. Close and reopen Companion to recover the latest state from main.

State is intentionally held in memory and resets when the application restarts.

[Full demonstration guide](docs/final-review.md)

## Architecture

```text
                   ELECTRON MAIN PROCESS
                 ┌───────────────────────┐
                 │    createMainStore    │
                 │                       │
                 │  Validate → Reduce    │
                 │  Commit → Revision    │
                 └───────────┬───────────┘
                             │
             Synchronous IPC │ Asynchronous broadcasts
                             │
                 ┌───────────▼───────────┐
                 │   Restricted Preload  │
                 │       IPC Bridge      │
                 └───────────┬───────────┘
                             │
                 ┌───────────▼───────────┐
                 │  createRendererStore  │
                 │    Revisioned Cache   │
                 └───────────┬───────────┘
                             │
                    useStoreState()
                             │
                         React UI
```

**Important distinction:** Authoritative reads and dispatches are synchronous. Rendering updates in other windows arrive asynchronously.

## Usage

### 1. Create the main-process store

```ts
import { createMainStore } from '@relay-state/store/core';

type State = { count: number };
type Action = { type: 'increment' };

const store = createMainStore<State, Action>({
  initialState: { count: 0 },

  parseAction(input: unknown) {
    if (
      !input ||
      typeof input !== 'object' ||
      !('type' in input) ||
      input.type !== 'increment'
    ) {
      throw new TypeError('Invalid action');
    }

    return { type: 'increment' };
  },

  reducer: (state) => ({
    count: state.count + 1,
  }),
});
```

### 2. Connect Electron

In the main process, attach the store using `attachElectronStore()` from `@relay-state/store/electron/main`.

The host application must supply `authorize` and `getRecipients` policies for approved windows and frames.

In preload, expose the restricted bridge:

```ts
import { contextBridge } from 'electron';
import { createSyncBridge } from '@relay-state/store/electron/preload';

contextBridge.exposeInMainWorld(
  'relayState',
  createSyncBridge('counter')
);
```

The namespace must match the one used by the main-process adapter.

### 3. Connect React

```tsx
import { createRendererStore } from '@relay-state/store/renderer';
import { createStoreHooks } from '@relay-state/store/react';

// State and Action are shared application types.
// window.relayState is the typed preload bridge.
const rendererStore = createRendererStore<State, Action>({
  bridge: window.relayState,
});

rendererStore.initialize();

const { useStoreState } = createStoreHooks(rendererStore);

function Counter() {
  const count = useStoreState((state) => state.count);

  return (
    <button onClick={() => rendererStore.dispatch({ type: 'increment' })}>
      {count}
    </button>
  );
}
```

Initialize the renderer store before mounting React. The hook reads cached state; synchronous IPC is reserved for explicit store operations.

See [Integration](docs/integration.md) for complete setup details and [Relay Tasks](apps/relay-tasks/src) for the working implementation.

## API Reference

| API | Responsibility |
| --- | --- |
| `createMainStore()` | Validates actions, owns authoritative state, commits revisions |
| `attachElectronStore()` | Registers authorized synchronous IPC handlers and broadcasts |
| `createSyncBridge()` | Provides fixed preload read, dispatch, and subscription methods |
| `createRendererStore()` | Exposes synchronous operations and a revisioned renderer cache |
| `createStoreHooks()` | Creates the reactive `useStoreState(selector)` hook |

### Consistency guarantees

- `getState()` in a renderer performs a synchronous authoritative read.
- `dispatch(action)` blocks until main acknowledges the commit, no-op, or rejection.
- `getCachedSnapshot()` and React hooks read local cached state without blocking IPC.
- Main commits are revisioned, and older broadcast snapshots cannot overwrite newer cache revisions.
- A failed transport can leave a write's outcome uncertain; such writes should not be retried automatically.

[Detailed consistency contract](docs/consistency.md)

## Testing

The implementation has passed local macOS verification and Linux GitHub Actions.

| Verification | Result |
| --- | --- |
| Unit tests | **23 passed** |
| Electron end-to-end tests | **7 passed** |
| TypeScript typecheck and ESLint | **Passed** |
| Production build | **Passed** |
| Independent package, React, and TypeScript consumers | **Passed** |
| GitHub Actions | [**Passing run**](https://github.com/5675413-starfish-industries-5675413/relay-state/actions/runs/42773282465) |

Run the suite:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:consumer
npm run test:e2e
```

Additional tools:

```bash
npm run benchmark:ipc
npm run audit:report
```

The IPC benchmark measures real synchronous calls using the built Electron application. The dependency audit currently identifies eight development-dependency findings, documented separately rather than automatically force-upgraded.

## Limitations

- Synchronous IPC blocks the renderer and should not be used for high-frequency or expensive operations.
- State is bounded, plain-data, immutable, and stored only in memory.
- Cross-window rendering is asynchronous, not simultaneous.
- Persistence, distributed collaboration, optimistic updates, and automatic recovery of uncertain writes are outside this implementation.
- Host applications must provide their own strict IPC sender authorization.
- `@relay-state/store` is currently a local workspace package, not a published npm package.

## Project Structure

```text
packages/relay-state/   Reusable TypeScript state management library
apps/relay-tasks/       Functional two-window Electron application
tests/consumer/         Independent packaged-library consumers
scripts/                Benchmark and dependency audit
docs/                   Architecture, integration, and verification
```

## Documentation

[Architecture](docs/architecture.md) · [Integration](docs/integration.md) · [Consistency](docs/consistency.md) · [Verification](docs/verification.md) · [Security](SECURITY.md)

## Contributing

Contributions are welcome. Review [CONTRIBUTING.md](CONTRIBUTING.md), preserve the synchronous consistency contract and security boundaries, and run the verification suite before opening a pull request.

## License

MIT — see [LICENSE](LICENSE).
