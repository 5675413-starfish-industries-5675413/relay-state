import { useSyncExternalStore } from 'react';
import type { DeepReadonly } from '../core/types';
import type { RendererStore } from '../renderer/types';

export function createStoreHooks<S, A>(store: RendererStore<S, A>) {
  // Stable identities: create once per renderer store, outside React components.
  const subscribe = (notify: () => void) => store.subscribe(() => notify());
  const getSnapshot = () => store.getCachedSnapshot();

  function useStoreState<T>(selector: (state: DeepReadonly<S>) => T): T {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    return selector(snapshot.state);
  }

  return { useStoreState };
}
