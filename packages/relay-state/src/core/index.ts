export { createMainStore } from './create-main-store';
export { RelayError, asRelayError } from './errors';
export { ownPlainData, DEFAULT_LIMITS, resolveLimits } from './plain-data';
export { ok, fail } from './types';
export type {
  DeepReadonly, PlainData, Snapshot, MainStore, MainStoreOptions, Reducer,
  StoreLimits, Unsubscribe, RelayErrorCode, Result,
} from './types';
