# Safe-launch — neohrabaťte user session

**MANDATORY READ** před jakýmkoli `spawn`, `launch`, `chromium.launch`, `_electron.launch`.

## Incident 2026-04-14

`child.kill()` na LevisIDE Electron procesu shodilo uživateli otevřený Chrome. Chromium/Electron sdílejí GPU/utility procesy nebo OS handle — zabít jeden může shodit jiný, který patří user session.

## Povinná pravidla (nikoli doporučení)

### 1. Detekce běžící instance PŘED spuštěním

**Electron:**
```bash
# Windows
tasklist | findstr electron.exe

# Unix
pgrep -f 'electron.*<appPath>'
```

Pokud existuje proces s cestou k cílové aplikaci → **STOP, zeptej se uživatele.** Nikdy nespouštěj druhou instanci automaticky — electron-store, SQLite DB, named pipes, porty sdílí.

**Browser (Chromium):**
- Před `chromium.launch()` se neptáme (vlastní audit profil), **ale** přidáváme vždy izolovaný `--user-data-dir`.

### 2. Izolovaný profil pro audit

Do args vždy:
```
--user-data-dir=<project>/.audit/profile
```

Nebo pro Electron:
```
spawn(electronBin, [appPath, '--user-data-dir=<tempDir>', ...])
```

Důvod: audit neovlivní user settings, electron-store, cache.

### 3. Graceful shutdown, ne SIGKILL

**Pořadí:**
1. `browser.close()` (CDP close)
2. Počkej 5s
3. `child.kill('SIGTERM')`
4. Počkej 3s
5. **Teprve pak** `SIGKILL`

Electron sám ukončí child procesy (GPU, utility) gracefully.

**NIKDY:**
- `taskkill /F`, `kill -9`, `child.kill('SIGKILL')` jako první krok
- Pattern-based kill (`taskkill /IM electron.exe /F`) — zabije i cizí instance

### 4. Never-zabitelné procesy

- Nezabíjet nic, co jsi sám nespustil.
- Procesy z user session (Chrome, Code, Claude Code, LevisIDE) jsou tabu.
- Pokud PID není v tvé spawn track listě, nedotýkej se.

## Checklist před každým spuštěním

- [ ] Proběhlo `tasklist`/`pgrep` a žádná další instance neběží?
- [ ] Args obsahují `--user-data-dir=<isolated>`?
- [ ] Máš shutdown sekvenci naplánovanou (finally block s `browser.close()` + graceful timeout)?
- [ ] PID tvého spawned procesu jsi uložil pro identification?

Pokud kterýkoli bod je `no`, **neespouštěj**. Zeptej se uživatele / vyjasni.
