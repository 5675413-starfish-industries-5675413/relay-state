import type { BrowserWindow, IpcMainEvent, WebContents } from 'electron';

export function makeWindowSecurity(allowedWindows: Set<BrowserWindow>, devUrl?: string) {
  const devOrigin = devUrl ? new URL(devUrl).origin : null;

  function approved(contents: WebContents): boolean {
    if (contents.isDestroyed()) return false;
    const window = [...allowedWindows].find((candidate) => !candidate.isDestroyed() && candidate.webContents === contents);
    if (!window) return false;
    try {
      const frame = contents.mainFrame;
      if (!frame) return false;
      const url = new URL(frame.url);
      const trustedOrigin = devOrigin
        ? url.origin === devOrigin
        : url.protocol === 'relayapp:' && url.host === 'app';
      return trustedOrigin && (url.pathname === '/' || url.pathname === '/index.html');
    } catch { return false; }
  }

  return {
    authorize(event: IpcMainEvent): boolean {
      return approved(event.sender) && event.senderFrame === event.sender.mainFrame;
    },
    getRecipients(): WebContents[] {
      return [...allowedWindows].map((win) => win.webContents).filter(approved);
    },
    isApprovedContents: approved,
  };
}
