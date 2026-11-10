import type { StateBridge } from '@relay-state/store/renderer';
import type { TaskAction, TaskState } from '../shared/types';

declare global {
  interface Window {
    relayState: StateBridge<TaskState, TaskAction>;
  }
}
export {};
