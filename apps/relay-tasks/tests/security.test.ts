import { describe, expect, it } from 'vitest';
import type { BrowserWindow, IpcMainEvent, WebContents } from 'electron';
import { makeWindowSecurity } from '../src/main/security';

function fixture(url = 'relayapp://app/#workspace') {
  const mainFrame = { url };
  let destroyed = false;
  const contents = {
    isDestroyed: () => destroyed,
    mainFrame,
  } as unknown as WebContents;
  const win = {
    isDestroyed: () => destroyed,
    webContents: contents,
  } as unknown as BrowserWindow;
  const registered = new Set<BrowserWindow>([win]);
  const event = { sender: contents, senderFrame: mainFrame } as unknown as IpcMainEvent;
  return {
    contents, win, registered, event,
    destroy: () => { destroyed = true; },
    setUrl: (value: string) => { mainFrame.url = value; },
  };
}

describe('demo sender authorization policy', () => {
  it('authorizes a registered production main frame and recipient', () => {
    const context = fixture();
    const security = makeWindowSecurity(context.registered);
    expect(security.authorize(context.event)).toBe(true);
    expect(security.getRecipients()).toEqual([context.contents]);
  });

  it('rejects unregistered windows even with an allowed URL', () => {
    const context = fixture();
    const security = makeWindowSecurity(new Set<BrowserWindow>());
    expect(security.authorize(context.event)).toBe(false);
    expect(security.getRecipients()).toEqual([]);
  });

  it('rejects subframes even when the registered window has an approved main frame', () => {
    const context = fixture();
    const security = makeWindowSecurity(context.registered);
    const subframeEvent = { sender: context.contents, senderFrame: { url: 'relayapp://app/' } } as unknown as IpcMainEvent;
    expect(security.authorize(subframeEvent)).toBe(false);
  });

  it('rejects navigation to untrusted origins or wrong application paths', () => {
    const context = fixture();
    const security = makeWindowSecurity(context.registered);
    context.setUrl('https://example.com/');
    expect(security.authorize(context.event)).toBe(false);
    expect(security.getRecipients()).toEqual([]);
    context.setUrl('relayapp://app/other');
    expect(security.authorize(context.event)).toBe(false);
  });

  it('enforces the exact configured development origin and rejects destroyed windows', () => {
    const context = fixture('http://localhost:5173/#workspace');
    const security = makeWindowSecurity(context.registered, 'http://localhost:5173/');
    expect(security.authorize(context.event)).toBe(true);
    context.setUrl('http://localhost:5174/');
    expect(security.authorize(context.event)).toBe(false);
    context.setUrl('http://localhost:5173/');
    context.destroy();
    expect(security.authorize(context.event)).toBe(false);
    expect(security.getRecipients()).toEqual([]);
  });
});
