# Globální pravidla pro Claude Code

## Reasoning effort

Effort se reguluje **implicitně přes model a komplexitu promptu**, ne přes
explicitní tag. Předchozí `<reasoning_effort>` tag byl pseudo-knob (model si
budget rozdělí sám podle úlohy) — vyhozený.

Claude 5 modely mají skutečný knob `effortLevel` (low/medium/high/**xhigh**/max)
— nastavitelný v settings.json nebo interaktivně, default `high`. Status lišta
ho ukazuje jen když se od defaultu liší (viz `scripts/statusline.js`).

- `xhigh` — coding a agentic práce (Claude Code tam má vlastní default)
- `high` — všechno ostatní intelligence-sensitive
- `low`/`medium` — na Opus 5 překvapivě silné, primární páka na cenu a latenci
- `max` — jen když korektnost přebíjí cenu; umí přemýšlet zbytečně dlouho

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

- **`implementer-mech`** (haiku) — mechanický task, 1-2 soubory, jasný spec
- **`implementer-multi`** (sonnet) — multi-file, integrace, cross-boundary refactor
- **`spec-reviewer`** (haiku) — deterministic spec ↔ code mapping (PASS/FAIL)
- **`code-reviewer`** (sonnet) — quality, smells, bugs, security (judgment-based)
- **`dead-code-scanner`** (haiku) — unused exports/imports/funkce
- **`architect`** (opus) — design decisions, ADR-style output
- **main coordinator / orchestrator** (= já, hlavní turn) → **opus** (default;
  fable si uživatel přepíná ručně přes `/model`)

**Aliasy modelů (Claude 5 éra).** Aliasy se samy mapují na nejnovější verze —
v agent frontmatteru je nech, nepiš full model ID.

| Alias    | Model        | Full ID            | Context | $/1M in-out |
| -------- | ------------ | ------------------ | ------- | ----------- |
| `haiku`  | Haiku 4.5    | `claude-haiku-4-5` | 200K    | $1 / $5     |
| `sonnet` | Sonnet 5     | `claude-sonnet-5`  | 1M      | $3 / $15    |
| `opus`   | **Opus 5**   | `claude-opus-5`    | 1M      | $5 / $25    |
| `fable`  | Fable 5      | `claude-fable-5`   | 1M      | $10 / $50   |

Fable 5 je nejsilnější veřejně dostupný model — dvojnásobná cena Opusu, takže
jen pro hlavní turn u nejtěžších věcí; subagentům ho nedávej. Mythos 5
(`claude-mythos-5`) je stejný model pro Project Glasswing — nemáme přístup.

Definice: `~/.claude/agents/<name>.md` (frontmatter má model + tools + role prompt).

**Dispatch:** Použij `subagent_type: "<name>"` v Agent tool callu. Model je v
frontmatteru — explicit `model:` parametr není potřeba, ale override-uje.

**Eskalace:** pokud subagent vrátí `BLOCKED` nebo `NEEDS_CONTEXT`, re-dispatch
o jednu úroveň výš (haiku → sonnet, sonnet → opus). Opus je strop pro subagenty
— nikdy ho nestřílej jako default „pro jistotu" a na fable neeskaluj.

**Kdy subagenta NEspouštět.** Opus 5 deleguje ochotněji než 4.8 a každý
dispatch platí kontext znovu (subagent si ho postaví, zreportuje, já si report
přečtu). Nedeleguj, když:

- to zvládnu sám pár tool cally — pár readů, hrstka editů, jeden grep
- jde o review nebo ověření vlastní práce → patří do hlavního loopu, ne
  do subagenta (od toho je `code-reviewer` až *po* implementaci, ne průběžně)
- jeden subagent stačí — nedělím jeden malý task mezi víc agentů

Když deleguju, tak delegaci dodržím: nepřepočítávám subagentův výstup a
nedělám jeho práci znovu. Paralelní dispatch je pro nezávislé tracky
(viz *Parallel batch mode*, strop 3 tasky/batch), ne pro rozkrájení jedné
drobnosti.

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

**Pre-bind subagenty:** definice v `~/.claude/agents/*.md` — dispatchuj přes
`subagent_type` (viz *Subagent budget* výše). 6 rolí: implementer-mech/multi,
spec-reviewer, code-reviewer, dead-code-scanner, architect.

---

Tech-specific pravidla jsou v samostatných skills (progressive disclosure):
- **Token-aware** (routing modelů subagentů + snapshot pro status panel + logging) → skill `token-aware`
- **Time calibration** (historical durations → P50/P90 prior pro odhady) → sekce výše
- **Electron security** (`contextIsolation`, CSP, IPC) → skill `electron-security`
- **TypeScript strict** (`any` s komentářem) → skill `typescript-strict`
- **i18n texty** (nehardcoduj) → skill `i18n-texts`
- **Design tokens** (žádné hardcoded hodnoty) → skill `design-tokens`
- **TSC verifikace po změně** → skill `tsc-verification`
