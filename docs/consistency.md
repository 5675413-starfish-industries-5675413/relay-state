# Consistency and failure contract

## What synchronous means

1. Main `getState()` reads main's owned immutable authoritative state in-process.
2. Main `dispatch()` parses/validates an action, runs a synchronous pure reducer, owns and freezes a candidate, commits revision (or keeps revision on no-op), notifies subscribers and returns the resulting snapshot.
3. Renderer `getState()` issues `sendSync`, receives the main snapshot, applies the revision gate before returning its read result.
4. Renderer `dispatch()` issues `sendSync` and returns the snapshot associated with its own action's main acknowledgment.
5. Renderer `refresh()` uses the same synchronous main read but returns the envelope.
6. Other windows receive asynchronous snapshot broadcasts, without a global rendering barrier.

The returned result describes what main processed **at that point**. A later commit can occur immediately afterward. An old read response never makes a renderer cache regress if it already accepted a newer revision.

## One commit order, not predefined arrival order

Main serializes reducer commits on its event loop. Actions racing from independent windows can arrive in different orders across runs. Each *actual* state-changing commit receives one increasing revision. Distinct additions survive if the domain reducer applies actions to the latest main state; conflicts are resolved according to actual commit order. Returning the same state reference is a no-op with no revision change or broadcast.

## Immutable plain data

Runtime copying and deep freezing applies to initial state, changed candidates and renderer snapshots in all builds. Allowed: `null`, booleans, strings, finite numbers, dense arrays and plain objects. No functions, undefined, symbols, prototypes, accessors, aliasing, cycles or sparse arrays. Default limits (adjust only after measurement): **262,144 UTF-8 serialized bytes**, **32 levels**, **10,000 visited nodes**, **16,384 code units per string**. Actions undergo the same constraints. Reducer impure external side effects cannot be rolled back.

## Failure classification

| Result | Meaning |
|---|---|
| Success, new revision | Authoritative commit finished before reply |
| Success, unchanged revision | Reducer returned same state reference; no-op |
| Invalid action | No commit |
| Reducer throws | No store commit (assuming reducer obeys immutability) |
| Unsupported candidate | Rejected before revision changes |
| Observer throws | Commit remains successful; observer failure isolated |
| Transport/process failure | Outcome may be unknown; no automatic retry |
| Main blocked/crashed | Calling renderer may hang; not cancellable through JS timeout |

## Initialization and lifecycle

Register broadcast listener before initial synchronous read. Apply all incoming responses and notifications through a `revision > cached.revision` gate. Explicit uninitialized state; cached reads before initialization throw. Failed init removes listener and supports retry. Dispose unsubscribes and disallows further operations. Main revisions restart at zero on process restart. Hot authority replacement is out of scope.

Main subscribers may read state but must not dispatch reentrantly and must not block on renderer replies. Renderer subscribers may read `getCachedSnapshot()` during notification but must not call `dispatch()`, `getState()` or `refresh()` recursively.

## Workload limits

Full snapshots scale with state size × recipient count × commit frequency. Synchronous reads and writes block renderer execution, and deep copies add cost. Suitable for small, infrequently updated shared application state—not pointer tracking, large documents or continuous telemetry. Measure latency under load before claiming production performance.
