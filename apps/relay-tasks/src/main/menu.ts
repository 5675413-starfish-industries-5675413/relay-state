import { Menu } from 'electron';
import type { MainStore } from '@relay-state/store/core';
import type { TaskState, TaskAction } from '../shared/types';
import { openCompanion } from './windows';

export function installMenu(store: MainStore<TaskState, TaskAction>): void {
  const menu = Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Tasks',
      submenu: [
        { label: 'Add example task', accelerator: 'CmdOrCtrl+Shift+A', click: () => {
          store.dispatch({
            type: 'task/add',
            task: { id: crypto.randomUUID(), title: 'Created from the native menu', completed: false, createdAt: Date.now() },
          });
        } },
        { label: 'Open companion', accelerator: 'CmdOrCtrl+Shift+C', click: openCompanion },
      ],
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
  Menu.setApplicationMenu(menu);
}
