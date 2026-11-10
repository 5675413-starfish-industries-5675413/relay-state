import { RelayError } from './errors';
import { ownPlainData, resolveLimits } from './plain-data';
import type { MainStore, MainStoreOptions, Snapshot } from './types';

export function createMainStore<S, A>(options: MainStoreOptions<S, A>): MainStore<S, A> {
  const limits = resolveLimits(options.limits);
  let snapshot: Snapshot<S> = Object.freeze({ revision: 0, state: ownPlainData(options.initialState, limits) });
  const listeners = new Set<(value: Snapshot<S>) => void>();
  let inDispatch = false;

  function dispatch(input: A): Snapshot<S> {
    if (inDispatch) throw new RelayError('REENTRANT', 'Nested main dispatch is not allowed');
    inDispatch = true;
    try {
      let action: ReturnType<typeof ownPlainData<A>>;
      try {
        const safeInput = ownPlainData(input, limits);
        const parsed = options.parseAction(safeInput);
        action = ownPlainData(parsed, limits);
      } catch (error) {
        throw new RelayError('INVALID_ACTION', 'Action validation failed', { cause: error });
      }

      let candidate: S | typeof snapshot.state;
      try {
        candidate = options.reducer(snapshot.state, action);
      } catch (error) {
        throw new RelayError('REDUCER_FAILED', 'Reducer threw; no state committed', { cause: error });
      }
      if (candidate === snapshot.state) return snapshot;
      const state = ownPlainData(candidate as S, limits);
      if (!Number.isSafeInteger(snapshot.revision + 1)) {
        throw new RelayError('INVALID_STATE', 'Revision limit reached');
      }
      snapshot = Object.freeze({ revision: snapshot.revision + 1, state });
      for (const listener of [...listeners]) {
        try {
          listener(snapshot);
        } catch (error) {
          try { options.onObserverError?.(error); } catch { /* observer reporting cannot revert a commit */ }
        }
      }
      return snapshot;
    } finally {
      inDispatch = false;
    }
  }

  return {
    getState: () => snapshot.state,
    getSnapshot: () => snapshot,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
