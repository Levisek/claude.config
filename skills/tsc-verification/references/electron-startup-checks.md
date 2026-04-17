# Electron startup check — safety

**Dříve než spustíš aplikaci**, čti `~/.claude/skills/visual-audit/references/safe-launch.md`. Platí stejná pravidla jako pro audit — detekce běžící instance, izolovaný profil, graceful shutdown.

## Rychlá verifikace, že main startne

### Variant A — `npm run dev` (pokud projekt má dev script)

```bash
# Spusť v samostatném terminálu / background s timeoutem
timeout 30 npm run dev
```

Hledej v outputu:
- `electron: Running` / `App ready` / `BrowserWindow created`
- **Žádné** `Error:`, `Uncaught`, `Unhandled promise rejection` v main section

### Variant B — přímo electron binary

```bash
# Timeout 15s — pro startup check stačí
timeout 15 npx electron . --enable-logging 2>&1 | head -50
```

## Check list

- [ ] Main proces zapsal alespoň jeden log řádek (`App ready` nebo ekvivalent)
- [ ] Bez `Error:` v prvních 50 řádcích stdout/stderr
- [ ] Renderer HTML se načetl (zjistí se z DevTools nebo z `did-finish-load` logu pokud je nastavený)
- [ ] CSP violations v console? (jedna červená vlajka pro `skill:electron-security`)
- [ ] DevTools se otevírají jen v dev buildu (ne v `app.isPackaged === true`)

## Proč ne jen `tsc`

`tsc` nezachytí:
- Chybějící runtime dep (missing module error až při require)
- Native deps rebuild issues (better-sqlite3, node-serialport, ...)
- Path chyby (`path.join(__dirname, 'preload.js')` když preload není built)
- CSP, která sice kompiluje, ale renderer blocked

## Anti-pattern

Nespouštěj Electron aplikaci bez timeoutu — běžící instance blokuje následný push/commit/test workflow a pokud exit-ne přes `child.kill()` může shodit jinou user session (incident 2026-04-14).
