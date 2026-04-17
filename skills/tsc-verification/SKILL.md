---
name: tsc-verification
description: Use at the END of a non-trivial series of changes in a TypeScript project — runs `npx tsc --noEmit` and requires zero errors before declaring work done. For Electron projects, additionally verifies main process starts without console errors. Do NOT use after trivial single-line edits, after read-only operations, in non-TypeScript projects, or mid-refactor when breakage is expected.
allowed-tools: Bash, Read
---

# TSC Verification Gate

Závěrečná brána před tím, než řekneš „hotovo". Zelené tsc ≠ code works, ale červené tsc = ever-so-definitely-broken.

## 1. `npx tsc --noEmit`

```bash
npx tsc --noEmit
```

- Timeout 120s (velké projekty jdou pomaleji).
- Musí skončit s `exit code 0` a bez stdout/stderr chyb.
- Pokud má projekt více `tsconfig.*.json` (monorepo, server/client split), zjisti který je relevantní pro změněné soubory a spusť ten (`npx tsc --noEmit -p tsconfig.server.json`).

## 2. Pokud tsc fail

- **Nepovaž úkol za hotový.** Přečti chyby, opravy, spusť znovu.
- Pokud chyba nesouvisí s tvými změnami (pre-existing), nahlas uživateli a zeptej se jestli to je známé.

## 3. Electron navíc — main proces startup check

Pokud projekt obsahuje `electron` v deps:

```bash
# Dev build
npm run dev -- --no-open   # nebo ekvivalent
# nebo přímo:
npx electron . --no-sandbox --enable-logging
```

- Čekej na log zahrnující `App ready` / `BrowserWindow created` / podobně.
- Watch out for:
  - `Error: Cannot find module 'X'` — missing dep nebo rebuild potřeba.
  - `Unhandled promise rejection` v main procesu.
  - CSP violations v console.
- Pokud main startuje a renderer se načte, test passed.
- **Neshazuj existující user session** — viz `references/electron-startup-checks.md`.

## 4. Kdy **ne**spouštět

- Single-line fix (změna stringu, oprava typo).
- Read-only operace (grep, review).
- Mid-refactor — když jsi teprv v půlce a víš že budou chyby.
- Projekty bez `tsconfig.json`.

## 5. Reporting

Po spuštění napiš uživateli jednu větu:
- `✅ tsc passed (0 errors, 8.3s)` nebo
- `❌ tsc: 3 errors — src/foo.ts:42, src/bar.ts:12, src/baz.ts:88` + navržený fix
