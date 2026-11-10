import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMainStore, ok } from '@relay-state/store/core';
import { createRendererStore } from '@relay-state/store/renderer';
import { createStoreHooks } from '@relay-state/store/react';

// This file runs in a separately installed npm-pack consumer, never via workspaces.
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const main = createMainStore({
  initialState: { theme: 'light' },
  parseAction(value) {
    if (value?.type !== 'theme/change' || !['dark', 'light'].includes(value.theme)) {
      throw new TypeError('Invalid preference');
    }
    return { type: 'theme/change', theme: value.theme };
  },
  reducer: (state, action) => state.theme === action.theme ? state : { theme: action.theme },
});
const bridge = {
  readSync: () => ok(main.getSnapshot()),
  dispatchSync: (action) => ok(main.dispatch(action)),
  onSnapshot: (listener) => main.subscribe(listener),
};
const renderer = createRendererStore({ bridge });
renderer.initialize();
const { useStoreState } = createStoreHooks(renderer);
const seen = [];
function Panel() {
  const theme = useStoreState((state) => state.theme);
  seen.push(theme);
  return createElement('span', { id: 'theme' }, theme);
}
const root = createRoot(document.getElementById('root'));
try {
  await act(async () => { root.render(createElement(Panel)); });
  assert.equal(document.getElementById('theme').textContent, 'light');
  await act(async () => { renderer.dispatch({ type: 'theme/change', theme: 'dark' }); });
  assert.equal(document.getElementById('theme').textContent, 'dark');
  assert.equal(main.getState().theme, 'dark');
  assert.equal(seen[0], 'light');
  assert.equal(seen.at(-1), 'dark');
  console.log('Independent React hook consumer: PASS');
} finally {
  await act(async () => { root.unmount(); });
  renderer.dispose();
  dom.window.close();
}
