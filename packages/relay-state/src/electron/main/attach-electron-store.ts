import { ipcMain } from 'electron';
import type { IpcMainEvent, WebContents } from 'electron';
import { RelayError } from '../../core/errors';
import { fail, ok } from '../../core/types';
import type { MainStore, Result, Snapshot } from '../../core/types';
import { channelsFor } from '../protocol';

export interface AttachElectronStoreOptions<S, A> {
  namespace: string;
  store: MainStore<S, A>;
  authorize: (event: IpcMainEvent) => boolean;
  getRecipients: () => readonly WebContents[];
  onTransportError?: (error: unknown) => void;
}

const occupied = new Set<string>();

/** The application supplies the trusted-window and origin policy. Never allow-all by default. */
export function attachElectronStore<S, A>(options: AttachElectronStoreOptions<S, A>): () => void {
  const channels = channelsFor(options.namespace);
  if (occupied.has(options.namespace)) {
    throw new RelayError('PROTOCOL_ERROR', 'Relay namespace is already attached');
  }
  occupied.add(options.namespace);
  let detached = false;

  function report(error: unknown): void {
    try { options.onTransportError?.(error); } catch { /* logging must not break commits */ }
  }

  function isAuthorized(event: IpcMainEvent): boolean {
    try { return options.authorize(event); } catch (error) { report(error); return false; }
  }

  function sendResult(event: IpcMainEvent, execute: () => Snapshot<S>): void {
    let result: Result<Snapshot<S>>;
    try {
      result = isAuthorized(event)
        ? ok(execute())
        : fail('FORBIDDEN', 'This frame is not authorized to use Relay State');
    } catch (error) {
      if (error instanceof RelayError) {
        result = fail(error.code, error.message);
      } else {
        report(error);
        result = fail('REDUCER_FAILED', 'The authoritative operation failed');
      }
    }
    // Every controlled path produces a plain, serializable reply.
    event.returnValue = result;
  }

  const onRead = (event: IpcMainEvent) => sendResult(event, () => options.store.getSnapshot());
  const onDispatch = (event: IpcMainEvent, action: unknown) =>
    sendResult(event, () => options.store.dispatch(action as A));

  const unsubscribe = options.store.subscribe((snapshot) => {
    let recipients: readonly WebContents[];
    try { recipients = options.getRecipients(); } catch (error) { report(error); return; }
    for (const contents of recipients) {
      try {
        if (!contents.isDestroyed()) contents.send(channels.snapshot, snapshot);
      } catch (error) { report(error); }
    }
  });

  try {
    ipcMain.on(channels.read, onRead);
    ipcMain.on(channels.dispatch, onDispatch);
  } catch (error) {
    unsubscribe();
    ipcMain.removeListener(channels.read, onRead);
    ipcMain.removeListener(channels.dispatch, onDispatch);
    occupied.delete(options.namespace);
    throw error;
  }

  return () => {
    if (detached) return;
    detached = true;
    ipcMain.removeListener(channels.read, onRead);
    ipcMain.removeListener(channels.dispatch, onDispatch);
    unsubscribe();
    occupied.delete(options.namespace);
  };
}
