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
