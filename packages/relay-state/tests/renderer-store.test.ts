import { describe, it, expect, vi } from 'vitest';
import { createRendererStore } from '../src/renderer';
import { fail, ok } from '../src/core';
import type { StateBridge } from '../src/renderer';
import type { Snapshot } from '../src/core';

type State = { count: number };
type Action = { type: 'increment' };
function fixture() {
  let authoritative: Snapshot<State> = { revision: 0, state: { count: 0 } };
  let notification: ((snapshot: Snapshot<State>) => void) | undefined;
  const off = vi.fn();
  const bridge: StateBridge<State, Action> = {
    readSync: () => ok(authoritative),
    dispatchSync: () => { authoritative = { revision: authoritative.revision + 1,
      state: { count: authoritative.state.count + 1 } }; return ok(authoritative); },
    onSnapshot: (listener) => { notification = listener; return off; },
  };
  return {
    bridge, off,
    emit: (snapshot: Snapshot<State>) => notification?.(snapshot),
    mainCommit: (count: number, revision: number) => { authoritative = { revision, state: { count } }; },
  };
}

describe('renderer-store contract', () => {
  it('initializes synchronously; dispatch returns a committed revision', () => {
    const { bridge } = fixture(); const store = createRendererStore({ bridge });
    store.initialize();
    expect(store.getCachedSnapshot().revision).toBe(0);
    expect(store.dispatch({ type: 'increment' }).revision).toBe(1);
    expect(store.getState().count).toBe(1);
  });
  it('authoritative reads update the hook cache even when broadcasts are withheld', () => {
    const test = fixture(); const store = createRendererStore({ bridge: test.bridge });
    store.initialize(); test.mainCommit(44, 5);
    expect(store.getCachedSnapshot().state.count).toBe(0);
    expect(store.getState().count).toBe(44);
    expect(store.getCachedSnapshot().revision).toBe(5);
  });
  it('older broadcasts cannot roll back a synchronous response', () => {
    const test = fixture(); const store = createRendererStore({ bridge: test.bridge });
    store.initialize(); test.mainCommit(99, 9);
    expect(store.refresh().revision).toBe(9);
    const listener = vi.fn(); store.subscribe(listener);
    test.emit({ revision: 3, state: { count: -1 } });
    expect(store.getCachedSnapshot().state.count).toBe(99);
    expect(listener).not.toHaveBeenCalled();
  });
  it('permits cached reads but rejects nested blocking calls from listeners', () => {
    const test = fixture(); const store = createRendererStore({ bridge: test.bridge });
    store.initialize(); const codes: string[] = [];
    store.subscribe(() => {
      expect(store.getCachedSnapshot().revision).toBe(2);
      try { store.getState(); } catch (error) { codes.push((error as { code: string }).code); }
      try { store.dispatch({ type: 'increment' }); } catch (error) { codes.push((error as { code: string }).code); }
    });
    test.emit({ revision: 2, state: { count: 2 } });
    expect(codes).toEqual(['REENTRANT', 'REENTRANT']);
  });
  it('disposal is idempotent and ignores late notifications', () => {
    const test = fixture(); const store = createRendererStore({ bridge: test.bridge });
    store.initialize(); store.dispose(); store.dispose();
    expect(test.off).toHaveBeenCalledOnce();
    test.emit({ revision: 55, state: { count: 55 } });
    expect(() => store.dispatch({ type: 'increment' })).toThrow();
  });
  it('cleans up and permits retry after a failed initialization', () => {
    const test = fixture(); const store = createRendererStore({
      bridge: { ...test.bridge, readSync: vi.fn().mockReturnValueOnce(fail('FORBIDDEN', 'no')).mockReturnValueOnce(ok({ revision: 0, state: { count: 0 } })) },
    });
    expect(() => store.initialize()).toThrow();
    expect(test.off).toHaveBeenCalledOnce();
    store.initialize();
    expect(store.getCachedSnapshot().revision).toBe(0);
  });
});
