import { useState } from 'react';
import type { FormEvent } from 'react';
import { dispatchTask } from '../store';

export function AddTaskForm({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = value.trim();
    if (!title) return;
    try {
      dispatchTask({ type: 'task/add', task: {
        id: crypto.randomUUID(), title, completed: false, createdAt: Date.now(),
      } });
      setValue('');
      setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Add failed'); }
  }
  return (
    <form onSubmit={submit} className="add-form">
      <label className="sr-only" htmlFor={compact ? 'quick-add' : 'add-task'}>New task</label>
      <input id={compact ? 'quick-add' : 'add-task'} value={value} maxLength={140}
        onChange={(event) => setValue(event.target.value)}
        placeholder={compact ? 'Quick-add a task…' : 'What needs to get done?'} />
      <button type="submit" disabled={!value.trim()}>Add</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
