---
name: visual-audit
description: Use when the user asks for a visual/UI audit, accessibility check, WCAG review, contrast audit, responsive audit, or Electron app UI review. Trigger also on Czech phrases "zkontroluj vzhled", "projdi UI", "a11y audit", "vizuální audit", or when user wants runtime verification of a deployed site / localhost URL / Electron app. Do NOT use for static code review, design critique without running the app, or when the target is not actually runnable.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Visual Audit — Guardian

> Runtime audit, ne grep. Skutečně to spustíme a koukneme.

## 0. Filosofie

- **Runtime > static** — co nevidíš, to neověříš. Screenshot je důkaz.
- **Konkrétní fix** — žádné „zlepšit kontrast". Vždy `file:line` + navržená hodnota tokenu.
- **Přístupnost není volitelná** — WCAG 2.2 AA je minimum.
- **Severity:** 🔴 blokuje release · 🟡 doporučení · 🟢 OK.
- **Deterministický výstup** — pravidla v YAML, ne v promptu.

## 1. Cíle (auto-detekce)

| Typ | Detekce | Runner |
|-----|---------|--------|
| **Live URL** | `http(s)://` v argu | `chromium.launch()` |
| **Localhost** | `localhost:xxxx` / `127.0.0.1:xxxx` | `chromium.launch()` |
| **Statický HTML** | `index.html` v cwd, bez package.json | `file://` + chromium |
| **Electron app** | `package.json` → `main` + `electron` v deps | CDP connect — viz `references/electron-setup.md` |
| **Vite/Next dev** | `package.json` script `dev`, port z configu | spustí dev + chromium |

## 2. Zdroje pravdy

- `rules/checklist.yaml` — obecná pravidla (V001–V099)
- `rules/electron.yaml` — Electron-specific (E001–E099)
- `references/report-template.md` — šablona VISUAL-AUDIT.md
- `references/electron-setup.md` — CDP protokol (Electron targety)
- `references/safe-launch.md` — **⚠️ mandatory read** před jakýmkoli spuštěním

**Pravidla se NEMĚNÍ per-projekt.** Výjimka = `.visual-audit.ignore` s ID pravidla + důvodem.

## 3. Průchod

1. **Detekce cíle** (viz §1). Jestli nejasné, zeptej se.
2. **⚠️ Safety check** — `references/safe-launch.md` povinně. Detekce běžící instance, izolovaný profil.
3. **Spuštění runneru** — headless Chromium / CDP connect.
4. **Screenshot baseline** — desktop (1440×900), tablet (768×1024), mobile (375×812). + dark mode pokud projekt podporuje.
5. **Průchod pravidel** — `kontrola` + `fix` pro každé pravidlo.
6. **Axe-core injekce** — `@axe-core/playwright` na každý viewport.
7. **Electron přídavky** — viz `references/electron-setup.md` (zoom, theme, multi-window).
8. **Generace reportu** — `VISUAL-AUDIT.md` v rootu + `.audit/` screenshoty.

## 4. Kategorie pravidel

| Prefix | Kategorie | Kde |
|--------|-----------|-----|
| V001–V019 | A11y (WCAG 2.2 AA) | `rules/checklist.yaml` |
| V020–V039 | Kontrast & barvy | `rules/checklist.yaml` |
| V040–V059 | Responsive & layout | `rules/checklist.yaml` |
| V060–V079 | Typografie & rytmus | `rules/checklist.yaml` |
| V080–V099 | UI stavy | `rules/checklist.yaml` |
| E001–E019 | Electron main/renderer | `rules/electron.yaml` |
| E020–E039 | IPC-driven UI state | `rules/electron.yaml` |
| E040–E059 | Native chrome | `rules/electron.yaml` |

## 5. Výstup

- `VISUAL-AUDIT.md` — report (viz `references/report-template.md`)
- `.audit/screenshots/` — před/po pro každý nález
- `.audit/axe.json` — raw axe output
- `.audit/meta.json` — Playwright/Chromium/Electron verze, timestamp, git sha

## 6. Command

`/visual-audit [cíl]`. Command je v `~/.claude/commands/visual-audit.md`.

Pokud `[cíl]` chybí a je `package.json` v cwd → auto-detekce (Electron / dev server). Jinak se zeptej.

---

Historie doktríny (deprecated `_electron.launch`): viz `CHANGELOG.md`.
