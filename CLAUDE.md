# Globální pravidla pro Claude Code

## Reasoning effort

Effort se reguluje **implicitně přes model a komplexitu promptu**, ne přes
explicitní tag. Předchozí `<reasoning_effort>` tag byl pseudo-knob (model si
budget rozdělí sám podle úlohy) — vyhozený.

Šetření probíhá hlavně přes **routing subagentů** (viz *Subagent budget*) a
**parallel batch mode** (viz níže). Před dispatchem 2+ subagentů invokuj skill
`token-aware` — vyhodnotí modely a zapíše snapshot pro status panel.

## Komunikace
- Mluv česky, neformálně
- Bez zbytečných otázek — když je záměr jasný, rovnou jednej
- Stručně, výstižně, žádné zbytečné shrnutí na konci

## Práce s kódem
- Nepřepisuj celé soubory, použij Edit tool
- Před změnou přečti soubor, ať vidíš aktuální stav
- Ukazuj jen změněné části kódu

## Commit workflow
- Commit message česky, krátký popis + případný kontext
- Nepřidávej Co-Authored-By ani jiné patičky — commituj jen pod uživatelovým jménem

## Procesy a instance — DŮLEŽITÉ

- **Nikdy nezabíjej procesy brute-force** (`kill`, `taskkill`, `child.kill()` bez graceful shutdown) když mohou být součástí běžící user session.
  - Důvod: incident 2026-04-14 — `child.kill()` na LevisIDE Electron procesu shodilo uživateli otevřený Chrome. Chromium/Electron sdílejí GPU/utility procesy nebo jiné OS handle.
- **Před spuštěním aplikace (Electron, dev server, browser) detekuj zda už běží jiná instance.** Pokud ano, zastav a zeptej se — NIKDY nespouštěj druhou ani neshazuj první.
- **Pro testy/audit:** vždy izolovaná instance — vlastní `--user-data-dir`, vlastní port, vlastní profil. Graceful shutdown přes IPC/`app.quit()`, ne SIGKILL.
- **Platí zejména pro:** Playwright / Puppeteer / Chromium launches, Electron `_electron.launch`, `spawn` s Electron binary, a jakékoli `taskkill`/`kill -9`.

## Subagent budget — pro plánované dispatche (zejména SDD)

Když pouštíš sérii subagentů (`subagent-driven-development`, `executing-plans`,
nebo vlastní fan-out), drž se tohoto routingu. SDD/superpowers default je moc
drahý a často nasadí sonnet na úkoly co zvládne haiku.

- **implementer** (mechanický task, 1–2 soubory, jasný spec) → **haiku**
- **implementer** (multi-file, integrace, refactor) → **sonnet**
- **spec reviewer** (porovná spec ↔ kód, žádný úsudek) → **haiku**
- **code quality reviewer** (hledá patterns, bugs, smells) → **sonnet**
- **final code reviewer** (celá implementace) → **sonnet** (jen pokud rozsáhlé → opus)
- **main coordinator / orchestrator** (tj. já) → **opus**

**Eskalace:** pokud subagent vrátí `BLOCKED` nebo `NEEDS_CONTEXT`, re-dispatch
o jednu úroveň výš (haiku → sonnet, sonnet → opus). Nikdy nestřílej opus jako
default „pro jistotu".

**Předávání Agent tool:** parametr `model: "haiku"` / `"sonnet"` / `"opus"` se
předává explicitně při dispatchi. Bez něj agent zdědí parent model = opus =
drahé. Vždy explicitně specifikuj model podle tabulky výše.

## Time calibration

Některé prompty (planning fáze, dotazy na odhad) dostanou auto-injectnutý blok
„Historical signals" z `cache/duration-stats.json` — agregace skutečných trvání
agent dispatchů per (repo × subagent_type) za posledních 90 dní.

**Treat injected duration stats as prior evidence. P90 is the realistic upper
bound. If your gut says „this is simple", check whether the historical P90
disagrees — it usually does.**

- Sběr: `hooks/log-duration.js` (volaný z `track-agents.js`) → `logs/agent-durations.jsonl`
- Agregace: `scripts/duration-stats.js` (on-demand + auto rebuild s 30s debounce po každém zápisu)
- Per-repo postmortem: `/postmortem` → `memory/surprises-<repo>.md` (auto-konzumováno detect-triggers při planning trigger)

Statistiky jsou per-repo. Pokud daný repo nemá ≥3 vzorky, nic se neinjektuje
(falešná čísla jsou horší než žádná).

## Parallel batch mode (SDD a fan-out) — DEFAULT

**Toto je default chování pro každý plánovaný dispatch s 3+ tasky.** Není
potřeba čekat na pokyn uživatele — automaticky postav conflict graph a batchuj.

**Algoritmus (automaticky při invokaci SDD):**
1. Extract tasks + target files (z plán dokumentu nebo z task description).
2. Postav conflict graph (hrany mezi tasky sdílející soubor).
3. Pick max 3 tasky bez konfliktů → **dispatch paralelně v jedné odpovědi**.
4. Per task uvnitř batche: pipeline implementer → spec → quality (sériová).
5. Mark batch complete, jeď další batch.

**Sériově jen pokud:** ≤2 tasky v plánu, nebo všechny sdílí jeden soubor, nebo
uživatel explicitně řekne *"jeď po jednom"*.

**Stop conditions:** implementer vrátí `BLOCKED` / `NEEDS_CONTEXT` → ten task
degraduj na sériový, batch dokonči bez něj. Detail viz
`subagent-driven-development` skill, sekce *Parallel Batch Mode*.

---

Tech-specific pravidla jsou v samostatných skills (progressive disclosure):
- **Token-aware** (routing modelů subagentů + snapshot pro status panel + logging) → skill `token-aware`
- **Time calibration** (historical durations → P50/P90 prior pro odhady) → sekce výše
- **Electron security** (`contextIsolation`, CSP, IPC) → skill `electron-security`
- **TypeScript strict** (`any` s komentářem) → skill `typescript-strict`
- **i18n texty** (nehardcoduj) → skill `i18n-texts`
- **Design tokens** (žádné hardcoded hodnoty) → skill `design-tokens`
- **TSC verifikace po změně** → skill `tsc-verification`
