# Integrate Relay State in another Electron app

## 1. Define the application domain

Create a TypeScript `State`, discriminated-union `Action`, pure synchronous reducer and runtime `parseAction(unknown)`. Never rely solely on compile-time TypeScript validation at the IPC boundary. Use readonly application state. Keep data small and IPC-clone compatible.

## 2. Instantiate in main

Call `createMainStore<State, Action>({ initialState, reducer, parseAction })` exactly once. Use the store directly from Electron native-menu handlers or other main code.

## 3. Attach the Electron adapter

Call `attachElectronStore({ namespace, store, authorize, getRecipients })`. `authorize` must verify registered window, permitted main frame and expected origin/path. `getRecipients` must return the same approved web contents, not `webContents.getAllWebContents()` without filtering. Hold the returned detach callback for shutdown.

## 4. Expose the preload facade

`contextBridge.exposeInMainWorld('relayState', createSyncBridge<State, Action>('namespace'))`. Do not expose raw `ipcRenderer`, events, filesystem or arbitrary channels. Bundle the preload to CommonJS for Electron's sandboxed context.

## 5. Initialize the renderer before React mount

`const store = createRendererStore({ bridge: window.relayState }); store.initialize();` then mount React. Handle initialization failure with visible retry. One renderer store per window and one hook factory per renderer store.

## 6. Consume the hook

`const { useStoreState } = createStoreHooks(store);` then `const value = useStoreState(state => state.value)`. The hook reads cached state with `useSyncExternalStore`, never synchronous IPC from inside a render. Event handlers may call `store.dispatch(action)` and receive a committed revision directly, but the call blocks the renderer.

## 7. Verify independent usage

Build the library, run `npm pack` and install into a separate directory with a completely different state domain. Check package exports and type declarations, not source aliases. Use `npm run test:consumer` after dependencies are installed.

See `apps/relay-tasks` for a concrete integration and `docs/verification.md` for acceptance tests.
