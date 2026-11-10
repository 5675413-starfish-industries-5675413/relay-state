import { useState } from 'react';
import { useStoreState, taskStore } from '../store';
import { AddTaskForm } from '../components/AddTaskForm';
import { TaskItem } from '../components/TaskItem';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';

type Filter = 'all' | 'active' | 'completed';

export function Workspace() {
  const tasks = useStoreState((state) => state.tasks);
  const [filter, setFilter] = useState<Filter>('all');
  const remaining = tasks.filter((task) => !task.completed).length;
  const visible = tasks.filter((task) => filter === 'all' || (filter === 'active' ? !task.completed : task.completed));
  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">R</span><span>Relay Tasks</span></div>
        <span className="topbar-meta">Main-authoritative · Electron</span>
      </header>
      <section className="content">
        <div className="intro"><p className="eyebrow">WORKSPACE</p><h1>One queue, every window.</h1>
          <p className="muted">Add here, complete in the companion, or use the native Tasks menu.</p></div>
        <AddTaskForm />
        <nav className="filters" aria-label="Task filters">
          {(['all', 'active', 'completed'] as const).map((name) => (
            <button className={filter === name ? 'selected' : ''} key={name} onClick={() => setFilter(name)}>
              {name === 'all' ? `All ${tasks.length}` : name === 'active' ? `Active ${remaining}` : `Completed ${tasks.length - remaining}`}
            </button>
          ))}
        </nav>
        {visible.length > 0 ? <ul className="task-list">{visible.map((task) => <TaskItem key={task.id} task={task} />)}</ul>
          : <p className="empty">{tasks.length === 0 ? 'Your queue is empty. Add a task above.' : 'No tasks match this filter.'}</p>}
        <DiagnosticsPanel />
      </section>
      <footer className="status"><span><span className="status-dot" />Ready · {remaining} remaining</span>
        <span>Revision {taskStore.getCachedSnapshot().revision}</span></footer>
    </main>
  );
}
