/** Electron-shared state is intentionally restricted to plain JSON-compatible data. */
export type PlainData = null | boolean | number | string | readonly PlainData[] | { readonly [key: string]: PlainData };
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? never
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export interface Snapshot<S> {
  readonly revision: number;
  readonly state: DeepReadonly<S>;
}

export type Unsubscribe = () => void;
export type Reducer<S, A> = (state: DeepReadonly<S>, action: DeepReadonly<A>) => S | DeepReadonly<S>;

export interface StoreLimits {
  readonly maxBytes: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxStringLength: number;
}

export interface MainStore<S, A> {
  getState(): DeepReadonly<S>;
  getSnapshot(): Snapshot<S>;
  dispatch(action: A): Snapshot<S>;
  subscribe(listener: (snapshot: Snapshot<S>) => void): Unsubscribe;
}

export interface MainStoreOptions<S, A> {
  readonly initialState: S;
  readonly reducer: Reducer<S, A>;
  readonly parseAction: (input: unknown) => A;
  readonly limits?: Partial<StoreLimits>;
  readonly onObserverError?: (error: unknown) => void;
}

export type RelayErrorCode =
  | 'INVALID_ACTION'
  | 'INVALID_STATE'
  | 'FORBIDDEN'
  | 'REDUCER_FAILED'
  | 'REENTRANT'
  | 'NOT_READY'
  | 'DISPOSED'
  | 'PROTOCOL_ERROR'
  | 'TRANSPORT_ERROR';

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: RelayErrorCode; readonly message: string } };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (code: RelayErrorCode, message: string): Result<never> => ({
  ok: false,
  error: { code, message },
});
