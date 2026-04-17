# Electron baseline — minimální secure BrowserWindow

## main.ts / main.js

```ts
import { app, BrowserWindow, session } from 'electron';
import path from 'path';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
  });

  // V produkci: load built index.html, v dev: load dev server.
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
};

app.whenReady().then(() => {
  // Globální CSP header (alternativa k meta tagu v HTML).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
        ],
      },
    });
  });
  createWindow();
});
```

## preload.ts / preload.js

```ts
import { contextBridge, ipcRenderer } from 'electron';

// Whitelist kanálů — free-form invoke je zakázaný.
const ALLOWED_INVOKE = ['db:query', 'fs:readConfig', 'app:getVersion'] as const;
type AllowedChannel = typeof ALLOWED_INVOKE[number];

contextBridge.exposeInMainWorld('api', {
  invoke: (channel: AllowedChannel, ...args: unknown[]) => {
    if (!ALLOWED_INVOKE.includes(channel)) {
      throw new Error(`Channel ${channel} není povolený`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
```

## renderer — typy pro `window.api`

```ts
declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}
```

## Checklist při review

- [ ] `contextIsolation: true` ve všech `BrowserWindow`
- [ ] `nodeIntegration: false` ve všech `BrowserWindow`
- [ ] `sandbox: true` (nebo explicitně odůvodněná výjimka v komentáři)
- [ ] `preload` odkazuje na existující soubor
- [ ] Preload exposuje **jen** whitelistované kanály
- [ ] CSP nastavené buď v HTML, nebo v `onHeadersReceived`
