import { ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { Snapshot, Result } from '../../core/types';
import type { StateBridge } from '../protocol';
import { channelsFor } from '../protocol';

/** Call in the preload isolated world; expose the returned fixed-method facade via contextBridge. */
export function createSyncBridge<S, A>(namespace: string): StateBridge<S, A> {
  const channels = channelsFor(namespace);
  return {
    readSync: () => ipcRenderer.sendSync(channels.read) as Result<Snapshot<S>>,
    dispatchSync: (action) => ipcRenderer.sendSync(channels.dispatch, action) as Result<Snapshot<S>>,
    onSnapshot(listener) {
      const wrapped = (_event: IpcRendererEvent, value: Snapshot<S>) => listener(value);
      ipcRenderer.on(channels.snapshot, wrapped);
      return () => { ipcRenderer.removeListener(channels.snapshot, wrapped); };
    },
  };
}
