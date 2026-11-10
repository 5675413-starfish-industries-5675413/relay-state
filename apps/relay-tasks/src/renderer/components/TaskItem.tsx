import { useState } from 'react';
import type { Task } from '../../shared/types';
import { dispatchTask } from '../store';

export function TaskItem({ task, compact = false }: { task: Task; compact?: boolean }) {
  const [error, setError] = useState('');
  function perform(action: Parameters<typeof dispatchTask>[0]) {
    try { dispatchTask(action); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Action failed'); }
  }
  return (
    <li className={`task-item ${task.completed ? 'is-done' : ''}`}>
      <label>
        <input type="checkbox" checked={task.completed}
          onChange={(event) => perform({ type: 'task/setCompleted', id: task.id, completed: event.target.checked })} />
        <span className="task-title">{task.title}</span>
      </label>
      {!compact && <button className="ghost danger" onClick={() => perform({ type: 'task/delete', id: task.id })}
        aria-label={`Delete ${task.title}`}>Delete</button>}
      {error && <p role="alert" className="error">{error}</p>}
    </li>
  );
}
