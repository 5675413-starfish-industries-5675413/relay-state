import { existsSync, writeFileSync } from 'node:fs';
import { app } from 'electron';
import type { TaskAction } from '../shared/types';

/** Test-only proof barrier. Released by a separate Node test process writing a file.
 * Never put the release signal on the blocked main event loop. Disabled normally.
 */
export function maybeBlockBeforeCommit(action: TaskAction): void {
  const path = process.env.RELAY_E2E === '1' && !app.isPackaged ? process.env.RELAY_E2E_GATE_FILE : undefined;
  if (!path || action.type !== 'task/add' || action.task.title !== '__relay_barrier_proof__') return;
  // External Playwright controller can observe this before asserting that IPC is blocked.
  // Both markers exist only in explicit test mode and never serve app requests.
  writeFileSync(`${path}.entered`, 'main-handler-entered');
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 10_000;
  while (!existsSync(path) && Date.now() < deadline) Atomics.wait(sleeper, 0, 0, 15);
  if (!existsSync(path)) throw new Error('Test barrier timed out without committing');
}
