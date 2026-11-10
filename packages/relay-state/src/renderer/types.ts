import type { DeepReadonly, Snapshot, StoreLimits, Unsubscribe } from '../core/types';
import type { StateBridge } from '../electron/protocol';

export type { StateBridge } from '../electron/protocol';

export interface RendererStore<S, A> {
  initialize(): void;
  getState(): DeepReadonly<S>;
  getCachedSnapshot(): Snapshot<S>;
  refresh(): Snapshot<S>;
  dispatch(action: A): Snapshot<S>;
  subscribe(listener: (snapshot: Snapshot<S>) => void): Unsubscribe;
  dispose(): void;
}

export interface RendererStoreOptions<S, A> {
  bridge: StateBridge<S, A>;
  limits?: Partial<StoreLimits>;
}
