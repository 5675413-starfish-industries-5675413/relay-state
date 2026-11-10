# Verification and release gates

No test result is claimed merely because the test source is present. Run these on a machine with Node 24 and Electron-compatible system libraries.

## Commands

```bash
npm install
npm run build:lib
npm run typecheck
npm test
npm run build
npm run test:consumer
# Linux: xvfb-run -a npm run test:e2e
npm run test:e2e
```

For dev: `npm run dev`. For built app: `npm run preview -w @relay-state/tasks`.

## Required behavior

| Requirement | Test/inspection |
|---|---|
| Main store starts at revision 0 | Unit |
| Action validation and immutable owned state | Unit |
| Pure synchronous reducer and unchanged-reference no-op | Unit |
| Subscriber errors cannot revert commits | Unit |
| Renderer does not accept stale broadcasts | Unit |
| Authoritative read updates stale local cache | Unit + E2E withheld broadcasts |
| No nested blocking calls from renderer subscriber | Unit |
| Main-originated and renderer-originated changes converge | E2E |
| Synchronous dispatch truly waits for main | E2E independent file barrier + code inspection |
| Main revision originates from actual commit | E2E main-process test hook |
| Invalid writes do not commit | Unit + E2E |
| Window close/reload | Manual + expand E2E |
| Sender authorization including untrusted frame | Manual + expand E2E negative tests |
| Sandboxed built preload works | E2E built app |
| Independent consumer | `npm run test:consumer` |

## The independent barrier

The E2E harness runs on its **own Node process**, which releases the main-process gate by writing a temporary file. A test-only gate in main waits synchronously for that file before validation/commit completes. While the gate is held, renderer `sendSync` cannot return. A barrier released through `electronApp.evaluate()` or another callback on blocked main would deadlock and is forbidden. The test has its own 10-second failure limit.

## Manual UI walkthrough

1. Launch built app: workspace and companion are visible.
2. Add a task in workspace; confirm companion reflects it.
3. Complete in companion; confirm workspace updates.
4. Trigger Tasks → Add example task; both windows update.
5. Click Diagnostics → Sync dispatch check; immediately read back the committed task.
6. Confirm invalid action rejection and no revision increase in tests.
7. Close companion, add a task, reopen via native menu and verify current state.
8. Reload companion; verify state restores from main.
9. Restart app; verify v0.1 intentionally resets state.
10. Record the real demo and add actual result badges only after CI passes.

## Platform caveats

Playwright's Electron support remains experimental. Run the built app on the intended reviewer OS (for example macOS), not only Linux CI. The current repo is a source demonstration and does not include an installer/signing/notarization pipeline.

## Before publication

Confirm npm package scope ownership; generate and commit `package-lock.json`; switch CI installation to `npm ci`; run tests; verify Electron build/preload names and production security policy; resolve all failures; attach a screen recording; tag v0.1.0 only after this succeeds. Do not claim compliance with an external evaluator's undisclosed rubric.

## Verified baseline and post-baseline hardening

The first fully green milestone is commit `db577e4` (macOS and GitHub Actions on Linux):
18 unit tests, 4 built-Electron E2E tests, full typecheck/lint/build, and a basic packed-package consumer.
This is a historical baseline, not a prediction of the status of later changes.
Consult the CI badge and latest GitHub Actions run for current pass/fail evidence.

The follow-up hardening suite adds these gates, **subject to CI passing**:

- A two-file synchronous barrier: the independent Playwright controller observes
  `release.entered` from Electron main before asserting that the renderer IPC call
  has not returned; then it writes `release` to unblock the main handler. The
  production state manager does not contain this test-only file barrier.
- Sender-policy unit tests for registered main frames, unregistered senders,
  forged subframes, unexpected paths/origins, and destroyed windows.
- Production Electron E2E checks of an unregistered, same-origin window's real
  read and write IPC replies; trusted-origin navigation rejection; and renderer
  reload/companion close/reopen behavior.
- An external npm-pack installation that typechecks a React + TypeScript
  consumer and mounts a real `useStoreState` component using a local bridge.
  It does **not** prove a second independently packaged Electron app works.

The E2E harness uses an external Playwright timeout; the test-only main barrier
also has its own 10-second limit. Never release a blocked main handler through
`electronApp.evaluate` (the main event loop would be blocked).

## Locked dependency graph

Install using `npm ci` from the committed `package-lock.json`.
CI uses `npm ci --no-audit --no-fund`; dependency audit findings are tracked
separately and do not justify blind breaking upgrades.
