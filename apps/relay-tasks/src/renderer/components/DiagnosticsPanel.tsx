import { useState } from 'react';
import { dispatchTask, taskStore, useStoreState } from '../store';

export function DiagnosticsPanel() {
  useStoreState((state) => state.tasks.length);
  const [message, setMessage] = useState('');
  const revision = taskStore.getCachedSnapshot().revision;

  function read() {
    try {
      const began = performance.now();
      const state = taskStore.getState();
      setMessage(`Authoritative read: ${state.tasks.length} tasks · ${(performance.now() - began).toFixed(2)} ms`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Read failed'); }
  }
  function prove() {
    try {
      const id = crypto.randomUUID();
      const result = dispatchTask({ type: 'task/add', task: {
        id, title: 'Synchronous verification', completed: false, createdAt: Date.now(),
      } });
      const current = taskStore.getState();
      if (!current.tasks.some((task) => task.id === id)) throw new Error('Authoritative read failed');
      setMessage(`Committed revision ${result.revision}; immediately readable · dispatch ${result.elapsedMs.toFixed(2)} ms`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Verification failed'); }
  }
  return (
    <section className="diagnostics" aria-label="State diagnostics">
      <div className="diagnostics-header">
        <strong>Diagnostics</strong><span className="muted">Cached revision {revision}</span>
      </div>
      <div className="diagnostics-actions">
        <button className="secondary" onClick={read}>Read authoritative state</button>
        <button className="secondary" onClick={prove}>Sync dispatch check</button>
      </div>
      {message && <output className="diagnostic-result">{message}</output>}
      <small className="muted">Blocking operations return after main processes them. Other windows render asynchronously.</small>
    </section>
  );
}
