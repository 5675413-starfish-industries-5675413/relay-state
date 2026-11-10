import { useState } from 'react';
import { useStoreState, taskStore } from '../store';
import { AddTaskForm } from '../components/AddTaskForm';
import { TaskItem } from '../components/TaskItem';

export function Companion() {
  const tasks = useStoreState((state) => state.tasks);
  const active = tasks.filter((task) => !task.completed);
  const [refreshError, setRefreshError] = useState('');
  function refresh() {
    try { taskStore.refresh(); setRefreshError(''); }
    catch (error) { setRefreshError(error instanceof Error ? error.message : 'Refresh failed'); }
  }
  return (
    <main className="companion">
      <header className="topbar"><div className="brand"><span className="brand-mark">R</span><span>Relay Tasks</span></div></header>
      <section className="companion-content">
        <p className="eyebrow">COMPANION</p>
        <h1>{active.length} {active.length === 1 ? 'task' : 'tasks'} remaining</h1>
        <p className="muted">Your shared queue, ready wherever you work.</p>
        {active.length > 0 ? <ul className="task-list">{active.slice(0, 9).map((task) =>
          <TaskItem key={task.id} task={task} compact />)}</ul> : <p className="empty">All caught up.</p>}
        {active.length > 9 && <p className="muted">+{active.length - 9} more tasks in workspace</p>}
        <AddTaskForm compact />
        <button className="secondary refresh" onClick={refresh}>Refresh authoritative state</button>
        {refreshError && <p className="error" role="alert">{refreshError}</p>}
      </section>
      <footer className="status"><span><span className="status-dot" />Ready</span>
        <span>Revision {taskStore.getCachedSnapshot().revision}</span></footer>
    </main>
  );
}
