---
name: visual-audit
description: Runtime vizuální audit webů a Electron aplikací. Spustí Playwright, projede checklist (a11y, kontrast, responsive, stavy, Electron-specific), vyplivne VISUAL-AUDIT.md se severity a fix hinty.
---

# Visual Audit — Guardian

> Runtime audit, ne grep. Skutečně to spustíme a koukneme.

---

## 0. FILOSOFIE

- **Runtime > static** — co nevidíš, to neověříš. Screenshot je důkaz.
- **Konkrétní fix** — žádné „zlepšit kontrast". Vždy `file:line` + navržená hodnota tokenu.
- **Přístupnost není volitelná** — WCAG 2.2 AA je minimum, ne cíl.
- **Severity tři úrovně:** 🔴 blokuje release · 🟡 doporučení · 🟢 OK.
- **Deterministický výstup** — stejný stav projektu = stejný report. Pravidla jsou v YAML, ne v promptu.

---

## 1. CÍLE AUDITU (auto-detekce)

| Typ | Detekce | Runner |
|-----|---------|--------|
| **Live URL** | `http(s)://` v argu | `chromium.launch()` |
| **Localhost** | `localhost:xxxx` / `127.0.0.1:xxxx` | `chromium.launch()` |
| **Statický HTML** | `index.html` v cwd, bez package.json | `file://` + chromium |
| **Electron app** | `package.json` → `main` + `electron` v deps | `_electron.launch({ args: ['.'] })` |
| **Vite/Next dev** | `package.json` script `dev`, port z configu | spustí dev + chromium na portu |

---

## 2. ZDROJE PRAVDY

- `checklist.yaml` — obecná pravidla (V001–V099), platí pro web i Electron renderer
- `electron.yaml` — Electron-specific pravidla (E001–E099)
- `report-template.md` — šablona výstupu (rámečky, sparkline severity, inline screenshoty)

**Pravidla se NEMĚNÍ per-projekt.** Pokud projekt chce výjimku, přidá `.visual-audit.ignore` s ID pravidel a důvodem.

---

## 3. PRŮCHOD AUDITEM

1. **Detekce cíle** — viz §1. Pokud nejasné, zeptej se uživatele.
2. **Spuštění runneru** — headless Chromium / Electron driver.
3. **Screenshot baseline** — desktop (1440×900), tablet (768×1024), mobile (375×812). Dark mode navíc pokud projekt podporuje.
4. **Průchod pravidel** — každé pravidlo má `kontrola` (jak ověřit) + `fix` (co navrhnout).
5. **Axe-core injekce** — `@axe-core/playwright` na každou viewport variantu.
6. **Electron přídavky** (pokud aplikace) — viz §5.
7. **Generace reportu** — `VISUAL-AUDIT.md` v rootu + `.audit/` složka se screenshoty.

---

## 4. KATEGORIE PRAVIDEL

| Prefix | Kategorie | Kde |
|--------|-----------|-----|
| V001–V019 | Přístupnost (a11y, WCAG 2.2 AA) | `checklist.yaml` |
| V020–V039 | Kontrast & barvy | `checklist.yaml` |
| V040–V059 | Responsive & layout | `checklist.yaml` |
| V060–V079 | Typografie & rytmus | `checklist.yaml` |
| V080–V099 | UI stavy (loading, empty, error, focus) | `checklist.yaml` |
| E001–E019 | Electron main/renderer | `electron.yaml` |
| E020–E039 | IPC-driven UI state | `electron.yaml` |
| E040–E059 | Native chrome (menu, titlebar, tray) | `electron.yaml` |

---

## 5. ELECTRON SPECIFIKA

**Driver = CDP connect (default)**, ne `_electron.launch`.

Důvod: `_electron.launch` injektuje `--inspect=0 --remote-debugging-port=0` což v Electron 41+ způsobuje že main proces v některých aplikacích nedokončí startup. Proto:

1. `spawn(electronBin, [appPath, '--remote-debugging-port=N', '--remote-allow-origins=*'])`
2. `waitForCDP(port)` — poll `/json/version`
3. `chromium.connectOverCDP('http://127.0.0.1:N')`
4. `browser.contexts()[0].pages()` → renderer stránky
5. Graceful shutdown: `browser.close()` → child.kill() **pouze** pokud proces po 5s sám neskončí

**Co funguje stejně jako přes `_electron.launch`:**
- `page.screenshot()` všech oken
- axe-core (v legacy mode: `new AxeBuilder({page}).setLegacyMode(true)`)
- Console / pageerror listening
- CSP violations (z console)

**Co funguje jinak:**
- **Zoom:** přes CDP `Emulation.setPageScaleFactor` (ne `webContents.setZoomFactor` main API)
- **Theme:** přes `page.emulateMedia({ colorScheme: 'dark'|'light' })` (ne `nativeTheme.themeSource`)
- **Main API eval není dostupný** — pro zoom/theme stačí CDP, ale nemůžeš volat `app.getAllWindows()` apod.

**Další kontrolní body:**
- DevTools se **nesmí** otevírat v produkčním buildu (skip v dev).
- Draggable regions: `-webkit-app-region: drag` nesmí pokrývat interaktivní prvky (viz E041).
- Multi-window: audit projde všechny `browser.contexts().flatMap(c => c.pages())`.

---

## 6. BEZPEČNOST SPUŠTĚNÍ — NEOHRABAŤ USER SESSION

**Incident 2026-04-14:** `child.kill()` na LevisIDE Electron procesu shodil uživateli otevřený Chrome. Chromium/Electron sdílejí OS procesy a handle.

**Povinná pravidla:**

1. **Detekuj běžící instanci PŘED spuštěním.** Pro Electron:
   - `tasklist | findstr electron.exe` (Win) nebo `pgrep -f 'electron.*<appPath>'` (Unix).
   - Pokud existuje proces s cestou k cílové aplikaci → **STOP, zeptej se uživatele.** Nikdy nespouštěj druhou instanci.

2. **Izolovaný profil audit procesu.**
   - Přidej `--user-data-dir=<project>/.audit/profile` do args.
   - Aby audit neinteragoval s user session, electron-store, atd.

3. **Graceful shutdown, ne SIGKILL.**
   - Order: `browser.close()` (CDP) → `child.kill('SIGTERM')` → čekat 3s → až potom `SIGKILL`.
   - Pokud existují child procesy (GPU, utility), Electron sám je ukončí gracefully.
   - **NIKDY** `taskkill /F`, `kill -9`, `child.kill('SIGKILL')` jako první volba.

4. **Never-zabitelné procesy:**
   - Nezabíjet nic, co audit sám nespustil.
   - Nezabíjet procesy z user session (Chrome, Code, Claude Code).

---

## 7. PŮVODNÍ DOKTRÍNA (deprecated — archiv)

Podsekce `_electron.launch` jsme opustili kvůli Electron 41 edge case (main proces exituje při `--inspect=0`). Zůstává jako fallback pro starší verze Electronu (do v30).

---

## 8. VÝSTUP

**Povinné artefakty:**
- `VISUAL-AUDIT.md` — lidsky čitelný report (viz `report-template.md`)
- `.audit/screenshots/` — před/po pro každý nález
- `.audit/axe.json` — raw axe-core output (reproducibility)
- `.audit/meta.json` — verze Playwright, Chromium, Electron, timestamp, git sha

**Report strukturou kopíruje grál:**
1. `0. SOUHRN` — severity bar, sparkline, git sha, timestamp
2. `1. KRITICKÉ` (🔴) — blokují release
3. `2. UPOZORNĚNÍ` (🟡) — doporučení
4. `3. OK` (🟢) — co prošlo (kompaktně, jen počty)
5. `4. ELECTRON` — jen pokud Electron cíl
6. `5. METADATA` — verze, cesta, git

---

## 9. COMMAND

Uživatel volá přes `/visual-audit [cíl]`. Command je v `~/.claude/commands/visual-audit.md`.

Pokud `[cíl]` chybí:
- Je-li `package.json` v cwd → zkus auto-detekci (Electron / dev server).
- Jinak zeptej se.
