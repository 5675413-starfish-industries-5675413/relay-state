import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication, Page } from 'playwright';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function launch(extraEnv: Record<string, string> = {}) {
  const electronApp = await electron.launch({
    args: ['.'], cwd: appRoot,
    env: { ...process.env, RELAY_E2E: '1', ...extraEnv },
  });
  await expect.poll(() => electronApp.windows().length).toBe(2);
  const all = electronApp.windows();
  const workspace = (await Promise.all(all.map(async (page) =>
    [page, await page.evaluate(() => location.hash)] as const)))
    .find((entry) => entry[1] === '#workspace')?.[0];
  const companion = (await Promise.all(all.map(async (page) =>
    [page, await page.evaluate(() => location.hash)] as const)))
    .find((entry) => entry[1] === '#companion')?.[0];
  if (!workspace || !companion) throw new Error('Expected workspace and companion');
  await expect(workspace.getByText('One queue, every window.')).toBeVisible();
  return { electronApp, workspace, companion };
}

async function mainSnapshot(electronApp: ElectronApplication) {
  return electronApp.evaluate(() => {
    const hook = (globalThis as typeof globalThis & {
      __relayE2E: { getSnapshot(): { revision: number; state: { tasks: { title: string }[] } } };
    }).__relayE2E;
    return hook.getSnapshot();
  });
}

async function suppress(electronApp: ElectronApplication, value: boolean) {
  await electronApp.evaluate((_electron, hold) => {
    const hook = (globalThis as typeof globalThis & { __relayE2E: { suppressBroadcasts(hold: boolean): void } }).__relayE2E;
    hook.suppressBroadcasts(hold);
  }, value);
}

test('workspace, companion and main all share one authoritative store', async () => {
  const { electronApp, workspace, companion } = await launch();
  try {
    await workspace.getByPlaceholder('What needs to get done?').fill('Review the actual manager');
    await workspace.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(companion.getByText('Review the actual manager')).toBeVisible();
    const snapshot = await mainSnapshot(electronApp);
    expect(snapshot.state.tasks.some((task) => task.title === 'Review the actual manager')).toBe(true);
    expect(snapshot.revision).toBeGreaterThan(0);
    await companion.getByRole('checkbox').first().check();
    await expect(workspace.getByText('Active 0')).toBeVisible();
  } finally { await electronApp.close(); }
});

test('synchronous authoritative read catches up while broadcasts are withheld', async () => {
  const { electronApp, companion } = await launch();
  try {
    await suppress(electronApp, true);
    await electronApp.evaluate(() => {
      const hook = (globalThis as typeof globalThis & {
        __relayE2E: { dispatch(action: unknown): void };
      }).__relayE2E;
      hook.dispatch({ type: 'task/add', task: {
        id: 'test-main-commit', title: 'Main-only change', completed: false, createdAt: 100,
      } });
    });
    await expect(companion.getByText('Main-only change')).toHaveCount(0);
    await companion.getByRole('button', { name: 'Refresh authoritative state' }).click();
    await expect(companion.getByText('Main-only change')).toBeVisible();
  } finally { await electronApp.close(); }
});

test('synchronous dispatch cannot return before main releases an independent barrier', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relay-e2e-'));
  const gate = join(dir, 'release');
  const { electronApp, workspace } = await launch({ RELAY_E2E_GATE_FILE: gate });
  try {
    let returned = false;
    const pending = workspace.evaluate(() => window.relayState.dispatchSync({
      type: 'task/add', task: { id: 'barrier-proof', title: '__relay_barrier_proof__',
        completed: false, createdAt: 100 },
    }));
    void pending.then(() => { returned = true; });
    // The timer lives in the separate Playwright controller, not blocked Electron main.
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    expect(returned).toBe(false);
    writeFileSync(gate, 'go');
    const answer = await pending;
    expect(answer.ok).toBe(true);
    const snapshot = await mainSnapshot(electronApp);
    expect(snapshot.state.tasks.some((task) => task.title === '__relay_barrier_proof__')).toBe(true);
    if (answer.ok) expect(answer.value.revision).toBe(snapshot.revision);
  } finally {
    writeFileSync(gate, 'go');
    await electronApp.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid actions return a structured rejection without committing', async () => {
  const { electronApp, workspace } = await launch();
  try {
    const before = await mainSnapshot(electronApp);
    const result = await workspace.evaluate(() => window.relayState.dispatchSync({ type: 'invalid' } as never));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_ACTION');
    const after = await mainSnapshot(electronApp);
    expect(after.revision).toBe(before.revision);
  } finally { await electronApp.close(); }
});
