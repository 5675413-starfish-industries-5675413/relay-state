import { describe, expect, it, vi } from 'vitest';
import { createMainStore, RelayError } from '../src/core';

type State = Readonly<{ count: number; nested: Readonly<{ tags: readonly string[] }> }>;
type Action = Readonly<{ type: 'increment' | 'no-op' | 'fail' | 'bad-state' }>;
const parseAction = (value: unknown): Action => {
  if (!value || typeof value !== 'object' || !('type' in value)) throw new Error('Invalid');
  if (!['increment', 'no-op', 'fail', 'bad-state'].includes(String(value.type))) throw new Error('Unknown');
  return { type: value.type as Action['type'] };
};
function makeStore() {
  return createMainStore<State, Action>({
    initialState: { count: 0, nested: { tags: ['original'] } },
    parseAction,
    reducer(state, action) {
      if (action.type === 'increment') return { ...state, count: state.count + 1 };
      if (action.type === 'fail') throw new Error('boom');
      if (action.type === 'bad-state') return { ...state, count: Number.NaN };
      return state;
    },
  });
}

describe('main-authoritative store', () => {
  it('starts at revision zero and synchronously commits', () => {
    const store = makeStore();
    expect(store.getSnapshot().revision).toBe(0);
    const result = store.dispatch({ type: 'increment' });
    expect(result.revision).toBe(1);
    expect(store.getState().count).toBe(1);
    expect(result).toBe(store.getSnapshot());
  });
  it('preserves revision and identity on a reference no-op', () => {
    const store = makeStore(); const first = store.getSnapshot();
    expect(store.dispatch({ type: 'no-op' })).toBe(first);
  });
  it('rejects invalid actions without mutation', () => {
    const store = makeStore();
    expect(() => store.dispatch({ type: 'wrong' } as unknown as Action)).toThrowError(RelayError);
    expect(store.getSnapshot().revision).toBe(0);
  });
  it('rejects reducer errors and invalid candidate states without committing', () => {
    const store = makeStore();
    expect(() => store.dispatch({ type: 'fail' })).toThrowError();
    expect(() => store.dispatch({ type: 'bad-state' })).toThrowError();
    expect(store.getSnapshot().revision).toBe(0);
  });
  it('isolates throwing observers from committed results', () => {
    const store = makeStore(); const second = vi.fn();
    store.subscribe(() => { throw new Error('observer'); });
    store.subscribe(second);
    expect(store.dispatch({ type: 'increment' }).revision).toBe(1);
    expect(second).toHaveBeenCalledOnce();
  });
  it('rejects nested dispatch inside a subscriber', () => {
    const store = makeStore(); let error: unknown;
    store.subscribe(() => { try { store.dispatch({ type: 'increment' }); } catch (caught) { error = caught; } });
    expect(store.dispatch({ type: 'increment' }).revision).toBe(1);
    expect(error).toMatchObject({ code: 'REENTRANT' });
  });
  it('owns and freezes nested initial state', () => {
    const initial = { count: 0, nested: { tags: ['original'] } };
    const store = createMainStore<State, Action>({ initialState: initial, parseAction,
      reducer: (state) => state });
    initial.nested.tags.push('external mutation');
    expect(store.getState().nested.tags).toEqual(['original']);
    expect(Object.isFrozen(store.getState().nested.tags)).toBe(true);
    expect(() => (store.getState().nested.tags as string[]).push('bad')).toThrow();
  });
});
