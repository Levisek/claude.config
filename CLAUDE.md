# Globální pravidla pro Claude Code

## Reasoning effort

Effort se reguluje **implicitně přes model a komplexitu promptu**, ne přes
explicitní tag. Předchozí `<reasoning_effort>` tag byl pseudo-knob (model si
budget rozdělí sám podle úlohy) — vyhozený.

Claude 5 modely mají skutečný knob `effortLevel` (low/medium/high/**xhigh**/max)
— nastavitelný v settings.json nebo interaktivně, upstream default `high`.
**My máme v `settings.json` napevno `"effortLevel": "xhigh"`**, protože tenhle
config se používá hlavně na coding. Status lišta ukazuje effort jen když se liší
od `high` (viz `scripts/statusline.js`), takže `xhigh` v liště uvidíš pořád —
to je záměr, ne bug. Jednorázově se přepíná přes `/effort`.

- `xhigh` — coding a agentic práce (Claude Code tam má vlastní default)
- `high` — všechno ostatní intelligence-sensitive
- `low`/`medium` — na Opus 5 překvapivě silné, primární páka na cenu a latenci
- `max` — jen když korektnost přebíjí cenu; umí přemýšlet zbytečně dlouho

**`max` do `settings.json` nepatří.** Na rozdíl od ostatních úrovní neplatí
napříč sessions — drží jen tu aktuální, pokud se nenastaví přes
`CLAUDE_CODE_EFFORT_LEVEL`. Používej ho jednorázově přes `/effort max`.

**`ultracode`** není effort level, ale nastavení Claude Code: pošle modelu
`xhigh` a navíc zapne orchestraci dynamických workflows. Jen pro aktuální
session, `settings.json` ani env proměnná ho nepřijmou — zapíná se `/effort
ultracode` nebo `claude --effort ultracode`.

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
  (vynuceno configem: `attribution: { commit: "", pr: "" }` v `settings.json`)

## Procesy a instance — DŮLEŽITÉ

- **Nikdy nezabíjej procesy brute-force** (`kill`, `taskkill`, `child.kill()` bez graceful shutdown) když mohou být součástí běžící user session.
  - Důvod: incident 2026-04-14 — `child.kill()` na LevisIDE Electron procesu shodilo uživateli otevřený Chrome. Chromium/Electron sdílejí GPU/utility procesy nebo jiné OS handle.
- **Před spuštěním aplikace (Electron, dev server, browser) detekuj zda už běží jiná instance.** Pokud ano, zastav a zeptej se — NIKDY nespouštěj druhou ani neshazuj první.
- **Pro testy/audit:** vždy izolovaná instance — vlastní `--user-data-dir`, vlastní port, vlastní profil. Graceful shutdown přes IPC/`app.quit()`, ne SIGKILL.
- **Platí zejména pro:** Playwright / Puppeteer / Chromium launches, Electron `_electron.launch`, `spawn` s Electron binary, a jakékoli `taskkill`/`kill -9`.

**Kill-by-name je vynucený hookem**, ne promptem — `hooks/block-destructive.js`
blokuje `taskkill /IM`, `taskkill /T`, `Stop-Process -Name`,
`Get-Process | Stop-Process`, `pkill`, `killall`, `kill-port`, `fuser -k`,
`wmic process delete` a `Invoke-CimMethod Terminate`. Platí i když se tahle
sekce vykompaktuje z kontextu, a hlavně **i v `bypassPermissions`**, kde se
`autoMode` vůbec nevyhodnocuje. Testy: `node --test hooks/block-destructive.test.js`.

Rozhoduje **selektor, ne signál**: adresný numerický PID (`taskkill /PID 1234`,
`Stop-Process -Id 1234`) projde, protože nemůže sáhnout na cizí okno. `/T`
neprojde ani s PID — zabíjí celý strom potomků.

`autoMode.soft_deny` v `settings.json` ta samá pravidla popisuje taky, ale
v bypass režimu je mrtvé — leží tam připravené, kdyby se `defaultMode` někdy
přepnul na `auto`. Nespoléhej na něj, spoléhej na hook.

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

Fable pro subagenty je tvrdě zablokovaný přes `permissions.deny` →
`Agent(model:fable)` v `settings.json`. Deny rule se vyhodnocuje před
classifierem i před promptem, takže tohle pravidlo nejde obejít omylem.

**Fallback:** `settings.json` má `fallbackModel: ["claude-sonnet-5"]` — když je
opus přetížený, session spadne na Sonnet 5 místo aby se zasekla.

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

## Dokumentace projektů → Obsidian

**Vaulty jsou dva a nemíchají se** — pracovní stroj nesmí dostat osobní
poznámky. O tom, který se použije, rozhoduje umístění projektu na disku:

| Projekt leží           | scope      | vault                   | env override                   |
| ---------------------- | ---------- | ----------------------- | ------------------------------ |
| pod `C:\dev\Work\`     | `work`     | `C:\dev\Work\Obsidian`  | `CLAUDE_OBSIDIAN_VAULT_WORK`   |
| kdekoli jinde          | `personal` | `C:\dev\vault`          | `CLAUDE_OBSIDIAN_VAULT`        |

Kořen pracovních projektů se dá přepsat přes `CLAUDE_WORK_ROOT`. Vault *Domácí
server* je oddělený a zůstává tematicky sevřený jen na homelab.

**Osobní projekt otevřený na pracovním stroji** (osobní vault není po ruce) se
nedokumentuje — místo toho vznikne v repu `.claude/doc-pending.md` s kontextem
projektu. Ten se commitne, doma se pullne a `doc-check` tam nabídne dokumentaci
sám. Handoff jde přes git, ne přes sdílený disk. Marker vzniká jen jednou;
po zapsání poznámky ho `doc-state.js --done` smaže.

Hook `doc-check.js` na SessionStart zjistí, jestli otevřený projekt má poznámku
v `🚀 Projekty/`. Když ne, injektuje do kontextu pokyn **nabídnout dokumentaci**
— zeptat se jednou větou, ne psát rovnou. Ptá se jen na `source=startup`, mlčí
u projektů s vlastním Obsidian vaultem a u složek, které nejsou projekt.

Odpověď se **musí zapsat**, jinak se hook zeptá při každém startu znovu:

```bash
node ~/.claude/scripts/doc-state.js --skip .           # nechce
node ~/.claude/scripts/doc-state.js --done . "<nota>"  # hotovo (smaže i marker)
node ~/.claude/scripts/doc-state.js --defer .          # odlož, zapíšu doma
node ~/.claude/scripts/doc-state.js --status .         # scope, vault, stav
```

Psaní poznámky řeší skill `obsidian-docs` — zná konvence vaultu (emoji v
názvech, frontmatter `tags` + `aktualizovano`, callouty, wikilinky, čeština).

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

**Subagenti od CC 2.1.195+ běží na pozadí by default.** Hlavní session čeká
jen na to, co potřebuje — ne na dokončení dispatche. Tím padá původní důvod
pro tvrdý strop 3 tasků na batch (byl to strop na *blokující* čekání, ne na
korektnost). Skutečné omezení je konflikt souborů, ne počet.

**Algoritmus (automaticky při invokaci SDD):**
1. Extract tasks + target files (z plán dokumentu nebo z task description).
2. Postav conflict graph (hrany mezi tasky sdílející soubor).
3. Vezmi **všechny vzájemně nekonfliktní tasky** z aktuální vrstvy →
   dispatch paralelně v jedné odpovědi. Měkký strop ~5; nad to už je režie
   čtení reportů větší než ušetřený čas a roste riziko, že si tasky vzájemně
   rozbijí předpoklady.
4. Per task uvnitř batche: pipeline implementer → spec → quality (sériová).
5. Mark batch complete, jeď další vrstvu.

**Sériově jen pokud:** ≤2 tasky v plánu, nebo všechny sdílí jeden soubor, nebo
uživatel explicitně řekne *"jeď po jednom"*.

**Stop conditions:** implementer vrátí `BLOCKED` / `NEEDS_CONTEXT` → ten task
degraduj na sériový, batch dokonči bez něj. Detail viz
`subagent-driven-development` skill, sekce *Parallel Batch Mode*.

**Nested dispatch.** Subagent si smí spawnout vlastního subagenta (CC stropuje
řetěz na 5 úrovní). Nepoužívej to jako default — náš routing je plochý
záměrně, ať je vidět kdo co platí. Dává to smysl jen když `architect` potřebuje
rozsáhlý průzkum, který se nevejde do jeho vlastního kontextu.

**Dynamic workflows.** Pro fan-out přes desítky až stovky subagentů existuje
upstream mechanismus, kde Claude napíše orchestrační skript. To je nadmnožina
tohohle ručního batchování. Náš conflict-graph postup drž pro plány řádu
jednotek až desítek tasků; nad to sáhni po workflow.

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
