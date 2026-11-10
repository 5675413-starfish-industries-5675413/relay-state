import { expect, it } from 'vitest';
import { taskReducer, INITIAL_STATE } from '../src/shared/reducer';
import { parseTaskAction } from '../src/shared/schema';

it('adds, completes, renames and deletes tasks', () => {
  const task = { id: 't-1', title: 'Write tests', completed: false, createdAt: 10 };
  const added = taskReducer(INITIAL_STATE, parseTaskAction({ type: 'task/add', task }));
  const completed = taskReducer(added, { type: 'task/setCompleted', id: 't-1', completed: true });
  const renamed = taskReducer(completed, { type: 'task/rename', id: 't-1', title: 'Review tests' });
  const deleted = taskReducer(renamed, { type: 'task/delete', id: 't-1' });
  expect(added.tasks).toHaveLength(1);
  expect(completed.tasks[0]?.completed).toBe(true);
  expect(renamed.tasks[0]?.title).toBe('Review tests');
  expect(deleted.tasks).toHaveLength(0);
});

it('rejects invalid task payloads and preserves idempotent updates', () => {
  expect(() => parseTaskAction({ type: 'task/add', task: { title: '' } })).toThrow();
  expect(taskReducer(INITIAL_STATE, { type: 'task/delete', id: 'missing' })).toBe(INITIAL_STATE);
});
