import { existsSync } from 'node:fs';
import type { TaskAction } from '../shared/types';

/** Test-only proof barrier. Released by a separate Node test process writing a file.
 * Never put the release signal on the blocked main event loop. Disabled normally.
 */
export function maybeBlockBeforeCommit(action: TaskAction): void {
  const path = process.env.RELAY_E2E === '1' ? process.env.RELAY_E2E_GATE_FILE : undefined;
  if (!path || action.type !== 'task/add' || action.task.title !== '__relay_barrier_proof__') return;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 10_000;
  while (!existsSync(path) && Date.now() < deadline) Atomics.wait(sleeper, 0, 0, 15);
  if (!existsSync(path)) throw new Error('Test barrier timed out without committing');
}
