import assert from 'node:assert/strict';
import { createMainStore } from '@relay-state/store/core';
import { createRendererStore } from '@relay-state/store/renderer';

const store = createMainStore({
  initialState: { theme: 'dark' },
  parseAction(value) {
    if (value?.type !== 'setTheme' || !['light', 'dark'].includes(value.theme)) throw Error('Invalid');
    return { type: 'setTheme', theme: value.theme };
  },
  reducer: (state, action) => state.theme === action.theme ? state : { theme: action.theme },
});
assert.equal(store.getState().theme, 'dark');
assert.equal(store.dispatch({ type: 'setTheme', theme: 'light' }).revision, 1);
assert.equal(store.getState().theme, 'light');
assert.equal(typeof createRendererStore, 'function');
console.log('Independent preferences-domain consumer: PASS');
