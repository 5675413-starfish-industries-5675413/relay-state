import { createRendererStore } from '@relay-state/store/renderer';
import { createStoreHooks } from '@relay-state/store/react';
import type { TaskAction, TaskState } from '../shared/types';

export const taskStore = createRendererStore<TaskState, TaskAction>({ bridge: window.relayState });
export const { useStoreState } = createStoreHooks(taskStore);

/** Returns a main-generated revision without awaiting, polling or optimistic updates. */
export function dispatchTask(action: TaskAction): { revision: number; elapsedMs: number } {
  const started = performance.now();
  const committed = taskStore.dispatch(action);
  return { revision: committed.revision, elapsedMs: performance.now() - started };
}
