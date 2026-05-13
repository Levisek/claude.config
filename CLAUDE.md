# Globální pravidla pro Claude Code

## Reasoning effort override
<reasoning_effort>75</reasoning_effort>

Toto je **floor** — výchozí úroveň. Skill `token-aware` ho může zvednout (99) nebo
snížit (60) podle úlohy. Na začátku každé netriviální odpovědi vyrenderuj status řádek
ve formátu `[ IQ:X │ main:opus │ agenti:… ]`. Před plánováním, psaním specs a
netriviální implementací invokuj skill `token-aware`.

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

---

Tech-specific pravidla jsou v samostatných skills (progressive disclosure):
- **Token-aware effort** (adaptivní reasoning + agent routing + status řádek) → skill `token-aware`
- **Electron security** (`contextIsolation`, CSP, IPC) → skill `electron-security`
- **TypeScript strict** (`any` s komentářem) → skill `typescript-strict`
- **i18n texty** (nehardcoduj) → skill `i18n-texts`
- **Design tokens** (žádné hardcoded hodnoty) → skill `design-tokens`
- **TSC verifikace po změně** → skill `tsc-verification`
