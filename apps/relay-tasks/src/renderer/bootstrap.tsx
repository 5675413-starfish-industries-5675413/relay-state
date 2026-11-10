import React from 'react';
import { createRoot } from 'react-dom/client';
import { taskStore } from './store';
import { App } from './App';
import './styles.css';

const target = document.getElementById('root');
if (!target) throw new Error('Missing root element');
const root = createRoot(target);

function start(): void {
  try {
    taskStore.initialize();
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } catch (error) {
    root.render(
      <main className="startup-error">
        <h1>Relay could not initialize</h1>
        <p>{error instanceof Error ? error.message : 'Unknown startup error'}</p>
        <button onClick={start}>Retry initialization</button>
      </main>,
    );
  }
}
start();
window.addEventListener('beforeunload', () => taskStore.dispose());
