# VISUAL-AUDIT — Runtime vizuální audit

Projede živý web nebo Electron app přes Playwright, vygeneruje `VISUAL-AUDIT.md` v rootu projektu.

**Argument:** `$ARGUMENTS` — cíl auditu. Volitelný.
- `http(s)://…` → live URL
- `localhost:xxxx` → běžící dev server
- prázdné → auto-detekce (Electron / Vite dev / statický index.html)

## Postup

### 1. Načti skill
- `~/.claude/skills/visual-audit/SKILL.md` — filosofie + kategorie
- `~/.claude/skills/visual-audit/checklist.yaml` — pravidla V001–V099
- `~/.claude/skills/visual-audit/electron.yaml` — pravidla E001–E099 (jen pokud Electron)
- `~/.claude/skills/visual-audit/report-template.md` — šablona reportu

### 2. Detekce cíle (v tomto pořadí)

1. Pokud `$ARGUMENTS` obsahuje `http` → **Live URL mode**.
2. Pokud `$ARGUMENTS` obsahuje `localhost:` → **Dev server mode** (nespouštěj dev, jen se připoj).
3. Pokud cwd obsahuje `package.json`:
   - `electron` v `dependencies`/`devDependencies` + `main` pole → **Electron mode**
   - `scripts.dev` existuje (vite/next/nuxt/etc) → nabídni spuštění dev serveru
4. Pokud cwd obsahuje `index.html` (bez package.json) → **Statický mode** (`file://`).
5. Jinak → zeptej se uživatele.

### 3. Připrav běh

- Ověř, že je nainstalovaný Playwright plugin (`~/.claude/plugins/` nebo `npx playwright --version`).
- Pokud chybí → nabídni instalaci, nedělej ji bez potvrzení.
- Pro Electron: zjisti `main` z package.json + spusť `_electron.launch({ args: ['.', ...], cwd: projectRoot })`.

### 4. Screenshoty baseline

- Viewporty: **375×812, 768×1024, 1024×768, 1440×900**
- Dark mode: pokud existuje `prefers-color-scheme` v CSS, navíc 1440×900 dark
- Ulož do `.audit/screenshots/baseline_<viewport>.png`

### 5. Průchod checklistu

Pro každé pravidlo z YAML:
- Spusť `kontrola` (buď axe-core rule, nebo vlastní evaluate callback).
- Zaznamenej: `pass` / `fail` / `skip` (když pravidlo nelze ověřit — např. V010 bez animací).
- Při `fail`: ulož screenshot s highlight zone do `.audit/screenshots/<ID>.png`.

### 6. Axe-core

- `@axe-core/playwright` injekce na každý viewport.
- Merge axe nálezů s YAML pravidly (dedup dle rule ID ↔ V0xx mapping v checklist.yaml).
- Uložit raw JSON do `.audit/axe.json`.

### 7. Electron extras (jen pokud Electron mode)

- Získej `app.windows()` → screenshot každého.
- Čti `win.webContents.on('console', ...)` → filter CSP violations.
- Zkoušej zoom 100/125/150% → screenshoty.
- `nativeTheme.themeSource = 'dark'` → screenshot → zpět `'light'` → screenshot.

### 8. Vygeneruj report

- Vyplň `report-template.md` hodnotami.
- Ulož jako `VISUAL-AUDIT.md` v rootu projektu.
- Uložit `.audit/meta.json` s verzemi.

### 9. Souhrn uživateli

Po dokončení napiš do chatu **pouze**:
```
Audit hotový. {{POCET_KRITIK}} kritik, {{POCET_UPOZORNENI}} upozornění.
Report: VISUAL-AUDIT.md
```

Neshrnuj obsah reportu — uživatel si ho otevře sám.

## Pravidla

- **Neupravuj kód** — audit je read-only. Fixy jsou návrhy v reportu.
- **Respektuj `.visual-audit.ignore`** — CSV nebo YAML se seznamem ID a důvodem.
- **Reproducibility** — vždy ulož git sha do meta.json. Stejný commit = stejný report.
- **Bez mock dat** — pokud stavy (V081–V083) nelze vyvolat bez mocků, označ jako `skip` s důvodem.
- **Neinstaluj závislosti bez souhlasu** — `@axe-core/playwright`, Playwright samotné.

## Když něco chybí

- Chybí Playwright → zastav, napiš „Potřebuju Playwright. Nainstalovat? (`npm i -D playwright @axe-core/playwright`)".
- Electron app neběží → zastav, zeptej se, jestli spustit `npm start` na pozadí.
- Není to web/electron projekt → „Tohle není vizuální cíl. Zkus `/audit` pro statický audit."
