# Electron audit — CDP setup protokol

## Driver = CDP connect, ne `_electron.launch`

Default strategie. Důvod: `_electron.launch` injektuje `--inspect=0 --remote-debugging-port=0` což v Electron 41+ způsobuje, že main proces v některých aplikacích nedokončí startup (zavěsí se na debug wait).

## Protokol

1. `spawn(electronBin, [appPath, '--remote-debugging-port=N', '--remote-allow-origins=*'])`
   - `N` = volný port (vyber z range 9200–9299)
   - `--remote-allow-origins=*` nutné kvůli CDP v recent Chromium
2. `waitForCDP(port)` — poll `http://127.0.0.1:N/json/version`, max 10s timeout
3. `chromium.connectOverCDP('http://127.0.0.1:N')`
4. `browser.contexts()[0].pages()` → renderer stránky
5. **Graceful shutdown:**
   - `browser.close()` (pošle CDP close all)
   - Pokud child proces po 5s běží, pošli `SIGTERM`
   - Až pokud ani po dalších 3s neskončí, `SIGKILL` — **jen** na náš vlastní spawned proces, nikdy na cizí

## Co funguje stejně jako přes `_electron.launch`

- `page.screenshot()` všech oken
- axe-core v legacy mode: `new AxeBuilder({ page }).setLegacyMode(true)`
- Console / `pageerror` listening
- CSP violations (z console, hledej `Refused to …`)

## Co funguje jinak

| Akce | Místo main API | Přes CDP |
|------|----------------|----------|
| **Zoom** | `webContents.setZoomFactor` | `page.evaluate(() => { /* CDP `Emulation.setPageScaleFactor` není dostupný z playwright API, použij`CDPSession.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 })` */ })` |
| **Theme** | `nativeTheme.themeSource = 'dark'` | `page.emulateMedia({ colorScheme: 'dark' })` |
| **Main API eval** | `app.getAllWindows()` | **není dostupné** — jen renderer |

## Multi-window

```ts
const contexts = browser.contexts();
const pages = contexts.flatMap(c => c.pages());
// Audit každou page zvlášť — každé okno je separate renderer
```

## Kontrolní body nad rámec obecného web auditu

- DevTools se **nesmí** otevírat v produkčním buildu (`app.isPackaged === true`)
- Draggable regions: `-webkit-app-region: drag` nepokrývá interaktivní prvky — viz pravidlo E041 v `rules/electron.yaml`
- Preload se načetl před document (zjistí se z toho, že `window.api` existuje na `DOMContentLoaded`)
- CSP je nastavená buď meta tagem nebo header (viz `~/.claude/skills/electron-security/references/csp.md`)
