# Contributing

This repository is a deliberately small demonstration of one synchronous Electron state-management mechanism. Changes should preserve the documented consistency contract, application/library separation and security boundaries.

1. Fork/clone and use Node 24.
2. Run `npm install`, then `npm run typecheck`, `npm test`, `npm run build`, `npm run test:consumer` and Electron integration tests.
3. Add a regression test when changing revision ordering, data validation, IPC handlers, or lifecycle behavior.
4. Do not expose raw Electron APIs in renderer components, add implicit authorize-all defaults, or introduce I/O in the synchronous commit path.
5. Keep performance claims tied to measured results and never present unexecuted checks as passing.

Do not add persistence, patch replication or new middleware merely as speculative enhancements to v0.1.
