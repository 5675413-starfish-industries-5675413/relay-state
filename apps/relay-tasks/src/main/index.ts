import { app, protocol, net, session } from 'electron';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { attachElectronStore } from '@relay-state/store/electron/main';
import { taskStore } from './store';
import { openWindows, openWorkspace, openCompanion } from './windows';
import { makeWindowSecurity } from './security';
import { installMenu } from './menu';

// Register the non-file origin before Electron becomes ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'relayapp', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const here = dirname(fileURLToPath(import.meta.url));
const rendererRoot = resolve(here, '../renderer');

function setupProductionOrigin(): void {
  protocol.handle('relayapp', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'app') return new Response('Forbidden', { status: 403 });
      const path = decodeURIComponent(url.pathname);
      const target = resolve(rendererRoot, `.${path === '/' ? '/index.html' : path}`);
      const rel = relative(rendererRoot, target);
      if (rel.startsWith('..') || rel.startsWith(sep) || rel === '') {
        return new Response('Forbidden', { status: 403 });
      }
      return net.fetch(pathToFileURL(target).toString());
    } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['relayapp://app/*'] },
    (details, callback) => callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
          "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'",
        ],
      },
    }),
  );
}

async function main(): Promise<void> {
  if (!process.env.ELECTRON_RENDERER_URL) setupProductionOrigin();
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const security = makeWindowSecurity(openWindows, process.env.ELECTRON_RENDERER_URL);
  let suppressNotifications = false;
  const detach = attachElectronStore({
    namespace: 'relay-tasks',
    store: taskStore,
    authorize: security.authorize,
    getRecipients: () => suppressNotifications ? [] : security.getRecipients(),
    onTransportError: (error) => console.error('Relay transport:', error),
  });

  // Explicit test-mode inspection is only in main and never exposed via contextBridge.
  if (process.env.RELAY_E2E === '1') {
    (globalThis as typeof globalThis & { __relayE2E?: unknown }).__relayE2E = {
      getSnapshot: () => taskStore.getSnapshot(),
      dispatch: (action: unknown) => taskStore.dispatch(action as Parameters<typeof taskStore.dispatch>[0]),
      suppressBroadcasts: (hold: boolean) => { suppressNotifications = hold; },
    };
  }

  installMenu(taskStore);
  openWorkspace();
  openCompanion();
  app.on('activate', () => { if (openWindows.size === 0) openWorkspace(); });
  app.on('before-quit', () => detach());
}

app.whenReady().then(main).catch((error: unknown) => {
  console.error('Relay startup failed:', error);
  app.exit(1);
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
