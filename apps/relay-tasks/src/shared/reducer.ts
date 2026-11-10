import type { DeepReadonly } from '@relay-state/store/core';
import type { TaskAction, TaskState } from './types';

export const INITIAL_STATE: TaskState = Object.freeze({ tasks: [] });
export const MAX_TASKS = 300;

export function taskReducer(state: DeepReadonly<TaskState>, action: DeepReadonly<TaskAction>): TaskState {
  switch (action.type) {
    case 'task/add':
      if (state.tasks.some((task) => task.id === action.task.id)) return state;
      if (state.tasks.length >= MAX_TASKS) throw new Error('Task limit reached');
      return { tasks: [...state.tasks, action.task] };
    case 'task/setCompleted': {
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task || task.completed === action.completed) return state;
      return { tasks: state.tasks.map((item) => item.id === action.id
        ? { ...item, completed: action.completed }
        : item) };
    }
    case 'task/rename': {
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task || task.title === action.title) return state;
      return { tasks: state.tasks.map((item) => item.id === action.id
        ? { ...item, title: action.title }
        : item) };
    }
    case 'task/delete':
      if (!state.tasks.some((item) => item.id === action.id)) return state;
      return { tasks: state.tasks.filter((item) => item.id !== action.id) };
  }
}
