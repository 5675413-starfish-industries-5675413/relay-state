import { createMainStore, ok, type DeepReadonly, type Snapshot } from '@relay-state/store/core';
import { createRendererStore, type StateBridge } from '@relay-state/store/renderer';
import { createStoreHooks } from '@relay-state/store/react';
import type { AttachElectronStoreOptions } from '@relay-state/store/electron/main';
import type { JSX } from 'react';
import type { StateBridge as PreloadContract } from '@relay-state/store/renderer';

type State = { theme: 'light' | 'dark' };
type Action = { type: 'theme/change'; theme: State['theme'] };
const main = createMainStore<State, Action>({
  initialState: { theme: 'light' },
  parseAction: (action: unknown): Action => {
    if (!action || typeof action !== 'object' || !('type' in action) || action.type !== 'theme/change'
      || !('theme' in action) || (action.theme !== 'light' && action.theme !== 'dark')) {
      throw new TypeError('Invalid preference action');
    }
    return { type: 'theme/change', theme: action.theme };
  },
  reducer: (state, action) => ({ ...state, theme: action.theme }),
});
const read = (): Snapshot<State> => main.getSnapshot();
const bridge: StateBridge<State, Action> = {
  readSync: () => ok(read()),
  dispatchSync: (action) => ok(main.dispatch(action)),
  onSnapshot: (listener) => main.subscribe(listener),
};
const alsoPreloadContract: PreloadContract<State, Action> = bridge;
const renderer = createRendererStore<State, Action>({ bridge: alsoPreloadContract });
const { useStoreState } = createStoreHooks(renderer);
function Preferences(): JSX.Element {
  const theme: DeepReadonly<State>['theme'] = useStoreState((state) => state.theme);
  return <span>{theme}</span>;
}
// Compile-check Electron-facing declaration without instantiating an Electron process.
const attachmentTypeCheck: AttachElectronStoreOptions<State, Action> | null = null;
void Preferences;
void attachmentTypeCheck;
