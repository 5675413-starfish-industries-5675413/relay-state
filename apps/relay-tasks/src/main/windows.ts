import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const openWindows = new Set<BrowserWindow>();
let companion: BrowserWindow | null = null;

function createWindow(kind: 'workspace' | 'companion'): BrowserWindow {
  const compact = kind === 'companion';
  const win = new BrowserWindow({
    title: compact ? 'Relay Tasks · Companion' : 'Relay Tasks · Workspace',
    width: compact ? 390 : 960,
    height: compact ? 530 : 690,
    minWidth: compact ? 340 : 660,
    minHeight: compact ? 390 : 470,
    backgroundColor: '#10151c',
    show: false,
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });
  openWindows.add(win);
  win.on('closed', () => {
    openWindows.delete(win);
    if (win === companion) companion = null;
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.once('ready-to-show', () => win.show());
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const url = devUrl || 'relayapp://app/';
  void win.loadURL(`${url}#${kind}`).catch((error: unknown) => console.error('Window load failed:', error));
  return win;
}

export function openWorkspace(): BrowserWindow {
  const existing = [...openWindows].find((win) => !win.isDestroyed() && win.webContents.getURL().endsWith('#workspace'));
  if (existing) { existing.focus(); return existing; }
  return createWindow('workspace');
}

export function openCompanion(): BrowserWindow {
  if (companion && !companion.isDestroyed()) { companion.focus(); return companion; }
  companion = createWindow('companion');
  return companion;
}
