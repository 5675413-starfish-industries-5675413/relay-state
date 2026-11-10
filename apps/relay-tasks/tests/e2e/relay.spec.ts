import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication } from 'playwright';

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
    await companion.getByRole('checkbox').first().click();
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
  const entered = `${gate}.entered`;
  const { electronApp, workspace } = await launch({ RELAY_E2E_GATE_FILE: gate });
  try {
    let returned = false;
    const pending = workspace.evaluate(() => window.relayState.dispatchSync({
      type: 'task/add', task: { id: 'barrier-proof', title: '__relay_barrier_proof__',
        completed: false, createdAt: 100 },
    }));
    void pending.then(() => { returned = true; });
    // An independent controller must observe main entering the handler first.
    // This prevents a delayed/unscheduled request from producing a false pass.
    await expect.poll(() => existsSync(entered), { timeout: 5_000 }).toBe(true);
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


test('an unregistered window cannot read or write even at the approved app origin', async () => {
  const { electronApp } = await launch();
  try {
    // Real production-bundled preload and IPC, but not registered in openWindows.
    const probe = await electronApp.evaluate(async ({ BrowserWindow, app }) => {
      const window = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: `${app.getAppPath()}/out/preload/index.cjs`,
          sandbox: true, contextIsolation: true, nodeIntegration: false,
        },
      });
      try {
        await window.loadURL('relayapp://app/#workspace');
        return await window.webContents.executeJavaScript(`({
          bridge: typeof window.relayState,
          nodeRequire: typeof window.require,
          read: window.relayState.readSync(),
          write: window.relayState.dispatchSync({ type: 'invalid' }),
        })`);
      } finally {
        window.destroy();
      }
    });
    expect(probe.bridge).toBe('object');
    expect(probe.nodeRequire).toBe('undefined');
    expect(probe.read).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(probe.write).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect((await mainSnapshot(electronApp)).revision).toBe(0);
  } finally { await electronApp.close(); }
});

test('window reload and companion close/reopen recover the current main snapshot', async () => {
  const { electronApp, workspace, companion } = await launch();
  try {
    await workspace.getByPlaceholder('What needs to get done?').fill('Survives renderer replacement');
    await workspace.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(companion.getByText('Survives renderer replacement')).toBeVisible();

    await companion.reload();
    await expect(companion.getByText('Survives renderer replacement')).toBeVisible();
    await companion.close();
    await expect.poll(() => electronApp.windows().length).toBe(1);

    // Invoke the existing native menu command, not a test-only mutation shortcut.
    await electronApp.evaluate(({ Menu, BrowserWindow }) => {
      const menu = Menu.getApplicationMenu();
      const openItem = menu?.items.find((item) => item.label === 'Tasks')
        ?.submenu?.items.find((item) => item.label === 'Open companion');
      if (!openItem?.click) throw new Error('Missing native Open companion action');
      openItem.click(openItem, BrowserWindow.getFocusedWindow()!, undefined as never);
    });
    await expect.poll(() => electronApp.windows().length).toBe(2);
    const reopened = electronApp.windows().find((page) => page !== workspace);
    if (!reopened) throw new Error('Companion failed to reopen');
    await expect(reopened.getByText('Survives renderer replacement')).toBeVisible();
    expect((await mainSnapshot(electronApp)).revision).toBe(1);
  } finally { await electronApp.close(); }
});

test('navigation away from the trusted origin is blocked', async () => {
  const { electronApp, workspace } = await launch();
  try {
    const trustedUrl = workspace.url();
    // The app registered its will-navigate prevention listener when the window
    // was created. Our observer runs after it and checks that it took effect.
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((candidate) =>
        candidate.webContents.getURL().endsWith('#workspace'));
      if (!win) throw new Error('Workspace not found');
      const probe = globalThis as typeof globalThis & {
        __relayNavigationAttempt?: { url: string; prevented: boolean };
      };
      delete probe.__relayNavigationAttempt;
      win.webContents.once('will-navigate', (event) => {
        probe.__relayNavigationAttempt = {
          url: event.url,
          prevented: event.defaultPrevented,
        };
      });
    });

    await workspace.evaluate(() => { window.location.assign('https://example.com/relay-escape'); });
    await expect.poll(() => electronApp.evaluate(() =>
      (globalThis as typeof globalThis & {
        __relayNavigationAttempt?: { url: string; prevented: boolean };
      }).__relayNavigationAttempt,
    )).toEqual({ url: 'https://example.com/relay-escape', prevented: true });

    // Inspect Electron's authoritative URL instead of a Playwright locator:
    // Playwright can continue waiting for the attempted navigation to settle
    // even when Electron has already canceled it.
    const currentUrl = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((candidate) =>
        candidate.webContents.getURL().endsWith('#workspace'));
      if (!win) throw new Error('Workspace left its trusted origin');
      return win.webContents.getURL();
    });
    expect(currentUrl).toBe(trustedUrl);
  } finally { await electronApp.close(); }
});
