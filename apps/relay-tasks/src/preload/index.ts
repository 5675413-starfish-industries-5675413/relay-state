import { contextBridge } from 'electron';
import { createSyncBridge } from '@relay-state/store/electron/preload';
import type { TaskState, TaskAction } from '../shared/types';

contextBridge.exposeInMainWorld('relayState', createSyncBridge<TaskState, TaskAction>('relay-tasks'));
