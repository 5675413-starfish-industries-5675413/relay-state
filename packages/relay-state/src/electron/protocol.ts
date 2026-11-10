import type { Result, Snapshot, Unsubscribe } from '../core/types';

export interface StateBridge<S, A> {
  readSync(): Result<Snapshot<S>>;
  dispatchSync(action: A): Result<Snapshot<S>>;
  onSnapshot(listener: (snapshot: Snapshot<S>) => void): Unsubscribe;
}

export function channelsFor(namespace: string) {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(namespace)) {
    throw new Error('Relay namespace must be lowercase kebab-case and at most 40 characters');
  }
  return {
    read: `${namespace}:read-sync`,
    dispatch: `${namespace}:dispatch-sync`,
    snapshot: `${namespace}:snapshot`,
  } as const;
}
