import { RelayError } from '../core/errors';
import { ownPlainData, resolveLimits } from '../core/plain-data';
import type { Result, Snapshot } from '../core/types';
import type { RendererStore, RendererStoreOptions } from './types';

export function createRendererStore<S, A>(options: RendererStoreOptions<S, A>): RendererStore<S, A> {
  const limits = resolveLimits(options.limits);
  let snapshot: Snapshot<S> | null = null;
  let ready = false;
  let disposed = false;
  let notifying = false;
  let unsubscribeBridge: (() => void) | null = null;
  const listeners = new Set<(snapshot: Snapshot<S>) => void>();

  function assertOperationAllowed(): void {
    if (disposed) throw new RelayError('DISPOSED', 'Renderer store is disposed');
    if (notifying) throw new RelayError('REENTRANT', 'Blocking calls inside renderer subscribers are forbidden');
  }
  function assertReady(): void {
    assertOperationAllowed();
    if (!ready) throw new RelayError('NOT_READY', 'Call initialize() before accessing state');
  }
  function verify(incoming: Snapshot<S>): Snapshot<S> {
    if (!incoming || !Number.isSafeInteger(incoming.revision) || incoming.revision < 0) {
      throw new RelayError('PROTOCOL_ERROR', 'Invalid authoritative revision');
    }
    try {
      return Object.freeze({ revision: incoming.revision, state: ownPlainData(incoming.state as S, limits) });
    } catch (error) {
      throw new RelayError('PROTOCOL_ERROR', 'Invalid authoritative snapshot', { cause: error });
    }
  }
  function accept(incoming: Snapshot<S>): Snapshot<S> {
    const validated = verify(incoming);
    if (snapshot === null || validated.revision > snapshot.revision) {
      snapshot = validated;
      notifying = true;
      try {
        for (const listener of [...listeners]) {
          try { listener(validated); } catch { /* one observer cannot break replication */ }
        }
      } finally {
        notifying = false;
      }
    }
    return validated;
  }
  function unwrap(result: Result<Snapshot<S>>): Snapshot<S> {
    if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
      throw new RelayError('PROTOCOL_ERROR', 'Malformed IPC result');
    }
    if (!result.ok) {
      if (!result.error || typeof result.error.message !== 'string') {
        throw new RelayError('PROTOCOL_ERROR', 'Malformed IPC error');
      }
      throw new RelayError(result.error.code, result.error.message);
    }
    return accept(result.value);
  }
  function perform(operation: () => Result<Snapshot<S>>): Snapshot<S> {
    try { return unwrap(operation()); }
    catch (error) {
      if (error instanceof RelayError) throw error;
      throw new RelayError('TRANSPORT_ERROR', 'Synchronous IPC failed; commit status may be unknown', { cause: error });
    }
  }

  const store: RendererStore<S, A> = {
    initialize() {
      assertOperationAllowed();
      if (ready) return;
      unsubscribeBridge = options.bridge.onSnapshot((incoming) => {
        if (disposed) return;
        try { accept(incoming); } catch { /* invalid broadcasts cannot poison the cache */ }
      });
      try {
        perform(() => options.bridge.readSync());
        ready = true;
      } catch (error) {
        unsubscribeBridge();
        unsubscribeBridge = null;
        snapshot = null;
        throw error;
      }
    },
    getState() {
      assertReady();
      // A successful authoritative read also refreshes the local React cache.
      return perform(() => options.bridge.readSync()).state;
    },
    refresh() {
      assertReady();
      // Returns this read's authoritative response; a newer cached revision remains accepted.
      return perform(() => options.bridge.readSync());
    },
    dispatch(action) {
      assertReady();
      return perform(() => options.bridge.dispatchSync(action));
    },
    getCachedSnapshot() {
      if (disposed) throw new RelayError('DISPOSED', 'Renderer store is disposed');
      if (!ready) throw new RelayError('NOT_READY', 'Renderer store is not initialized');
      if (!snapshot) throw new RelayError('NOT_READY', 'No accepted snapshot');
      return snapshot;
    },
    subscribe(listener) {
      if (disposed) throw new RelayError('DISPOSED', 'Renderer store is disposed');
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ready = false;
      unsubscribeBridge?.();
      unsubscribeBridge = null;
      listeners.clear();
      snapshot = null;
    },
  };
  return store;
}
