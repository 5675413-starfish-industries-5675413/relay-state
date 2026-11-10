# Final reviewer demonstration, performance, and dependency review

This is the **submission evidence plan**, not a claim that every manual step or machine-specific benchmark has already run. The main-process store and Electron E2E baseline were verified at commit `076b1ba` (23 unit tests, 7 built-Electron tests, typecheck, lint, build, and external consumers). Check the latest GitHub Actions run before quoting numbers.

## A. Manual production-build demonstration on macOS

From the repository root, with Node 24:

```bash
npm ci
npm run build
npm run preview -w @relay-state/tasks
```

`electron-vite preview` launches the built app. The **Workspace** and **Companion** windows should open. This is a runtime smoke test, not the E2E runner; neither `RELAY_E2E` nor the test-only main inspection hook is needed.

1. **Baseline.** Place both windows side by side. Confirm the Workspace shows `One queue, every window.` and the Companion displays `0 tasks remaining`. Note the revision, initially `0` in a fresh process.
2. **Workspace → Companion.** Add `Prepare demo walkthrough` in the Workspace. Its count increases, and the Companion displays the same task without manual refresh. Expect an authoritative revision increment.
3. **Companion → Workspace.** Check the task in Companion. It disappears from the Companion's active-only list, and the Workspace shows it as complete, with its active count reduced. The revision increments again.
4. **Main → Both.** In macOS's top menu bar choose **Tasks → Add example task** (or `⌘⇧A`). The new task appears in both windows. This dispatch originates in Electron main, not either renderer.
5. **Synchronous contract.** In Workspace **Diagnostics**, choose **Read authoritative state** to display a timed synchronous main read. Choose **Sync dispatch check**: the app commits a new task, immediately performs another authoritative read, and shows the returned committed revision and dispatch duration. No `await` is involved.
6. **Lifecycle.** Close Companion; add another task in Workspace; choose **Tasks → Open companion** (`⌘⇧C`). The reopened window reads the current authoritative state. Reload Companion and confirm its contents remain. (Tasks deliberately do **not** persist across a full application quit/restart.)
7. **Negative evidence.** Run `npm run test:e2e`; point to the named tests proving rejected unauthorized IPC, blocked cross-origin navigation, stale broadcast recovery and the main-entered synchronous barrier. There is no need to expose test hooks in the live UI.

**Recording:** macOS `Shift-Command-5` → Record Selected Portion. Capture both app windows and the relevant menu/diagnostics. A 2–3 minute recording is enough. Avoid claiming two windows repaint synchronously: they **do not**. The synchronous guarantee is about calling and receiving the main-authoritative result.

## B. Repeatable IPC benchmark

Run from the root:

```bash
npm run benchmark:ipc
```

This builds and launches Relay Tasks in **normal production-preview mode** using Playwright only as an external launcher/controller. The benchmark calls the **real restricted preload bridge** from the renderer, times calls inside the renderer via `performance.now()` (not through Playwright RPC timing), and verifies successful committed/no-op revision replies. The app is launched without `RELAY_E2E`.

The script samples three small task-state sizes (approximately 0, 20 and 80 tasks), with 80 reads, 30 no-op dispatches and 12 committed dispatches per phase. It reports p50, p95, maximum and mean round-trip duration in milliseconds and saves raw summary data in ignored `.verification/ipc-benchmark.json`.

**Benchmark interpretation:** A read includes synchronous IPC and snapshot cloning. A committed dispatch includes IPC, action validation, reducer execution, state ownership, revisioning, broadcast scheduling and return serialization. No-op dispatch exercises the validation/transport path without revising state. These measurements are exploratory on one machine, not a latency guarantee or a rigorous throughput/benchmark comparison.

Record the observed results instead of fabricating them:

| Device / OS / Electron | Approx. task count | Operation | n | p50 (ms) | p95 (ms) | Maximum (ms) |
|---|---:|---|---:|---:|---:|---:|
| *Run benchmark* | 0 | readSync | 80 | — | — | — |
| *Run benchmark* | 20 | dispatchSync no-op | 30 | — | — | — |
| *Run benchmark* | 80 | dispatchSync commit | 12 | — | — | — |

At 60 Hz, ~16.7 ms is a full frame budget. Even a short synchronous call consumes renderer time; latency tails matter more than a promising average. Electron warns that `sendSync` blocks the renderer and recommends asynchronous IPC generally. Relay's design is appropriate **for demonstrating the requested literal synchronous contract with small, bounded, infrequent state operations**, not for high-frequency UI events, disk/network I/O, or heavy reducers. A hung main process can hang the caller and a renderer-local timeout cannot safely cancel an in-flight `sendSync`.

## C. Dependency audit and triage

From the root:

```bash
npm run audit:report
```

This executes **read-only** `npm audit --json` and `npm audit --omit=dev --json`, prints findings by package, severity, direct/transitive status, affected versions, available fix, and advisory links. It saves both full reports under ignored `.verification/`. `npm audit` returning exit code 1 when advisories are present is normal; the reporting script still produces a triage table.

The previous installation reported eight findings (one low and seven moderate); that count may change as advisories and dependency versions change. **Do not infer individual package names or exploitability from that summary.** Classify each finding by:

- **Where executed:** Electron main/preload/renderer runtime, build tooling, test-only dependency, or transitive dependency. `--omit=dev` is a useful comparison but **does not** prove runtime safety: Electron itself is a devDependency here, and build tools execute during CI.
- **Reachability and impact:** Does app-controlled or untrusted input reach the vulnerable code path? Can it cross IPC security boundaries, execute code or access local files? Document evidence, not assumption.
- **Available fix:** Does a compatible version resolve it? Review `npm audit fix --dry-run --json` before deciding. Do not run `npm audit fix --force` or install blanket overrides without inspection.
- **Verification:** For a targeted dependency change, rerun `npm ci`, `typecheck`, `lint`, `test`, `build`, `test:consumer`, and `test:e2e`, then verify clean Linux CI. If knowingly deferring a finding, record the advisory URL, affected tree, rationale and review date.

One audit-report entry can represent multiple underlying advisories; compare the exact advisories, not only the total. Do not add a blanket CI ignore rule merely to retain a green badge.

## D. Reviewer story and final acceptance

**What to show first:** `packages/relay-state/src/core/create-main-store.ts`, `.../electron/main/attach-electron-store.ts`, `.../electron/preload/create-sync-bridge.ts`, `.../renderer/create-renderer-store.ts`, and `.../react/create-store-hooks.ts`. They expose an application-independent manager and hook. Then show `apps/relay-tasks`: a real two-window app and native-menu actions consuming the same library.

**Submission contract:** renderer `getState()` and `dispatch()` actually block for main's read/commit reply; `getCachedSnapshot()` and React `useStoreState()` are nonblocking local reads, while updates in other windows arrive asynchronously. Security relies on the consuming application's sender authorization, sandboxed preload and narrow bridge. It is *sender-authorized IPC*, not cryptographic authentication or globally shared memory.

**Ready for reviewer handoff when:** manual built-app walkthrough succeeds on macOS; a real latency report has been collected; dependency advisories have been triaged or fixed with documented evidence; the latest CI is green on the final commit; README examples and limitations match the source. An installer, notarization, persistence, npm publication, distributed state or CRDTs are outside this assignment's accepted scope.
