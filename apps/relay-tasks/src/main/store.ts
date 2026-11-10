import { createMainStore } from '@relay-state/store/core';
import { INITIAL_STATE, taskReducer } from '../shared/reducer';
import { parseTaskAction } from '../shared/schema';
import type { TaskState, TaskAction } from '../shared/types';
import { maybeBlockBeforeCommit } from './test-gate';

export const taskStore = createMainStore<TaskState, TaskAction>({
  initialState: INITIAL_STATE,
  parseAction(input) {
    const action = parseTaskAction(input);
    maybeBlockBeforeCommit(action);
    return action;
  },
  reducer: taskReducer,
  onObserverError: (error) => console.error('Relay observer:', error),
});
