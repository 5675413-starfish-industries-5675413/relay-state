import type { Task, TaskAction } from './types';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= 80;
const title = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 140;

function parseTask(value: unknown): Task {
  if (!record(value) || !identifier(value.id) || !title(value.title) ||
      typeof value.completed !== 'boolean' || !Number.isSafeInteger(value.createdAt) ||
      typeof value.createdAt !== 'number' || value.createdAt < 0) {
    throw new TypeError('Invalid task payload');
  }
  return { id: value.id, title: value.title.trim(), completed: value.completed, createdAt: value.createdAt };
}

export function parseTaskAction(value: unknown): TaskAction {
  if (!record(value)) throw new TypeError('Expected an action object');
  switch (value.type) {
    case 'task/add': return { type: 'task/add', task: parseTask(value.task) };
    case 'task/setCompleted':
      if (!identifier(value.id) || typeof value.completed !== 'boolean') break;
      return { type: 'task/setCompleted', id: value.id, completed: value.completed };
    case 'task/rename':
      if (!identifier(value.id) || !title(value.title)) break;
      return { type: 'task/rename', id: value.id, title: value.title.trim() };
    case 'task/delete':
      if (!identifier(value.id)) break;
      return { type: 'task/delete', id: value.id };
  }
  throw new TypeError('Unknown or malformed task action');
}
