# Claude Code — osobní config

Globální Claude Code setup pro Windows: CLAUDE.md pravidla, slash commandy, hooks, skills (vlastní + externí) a integrace se Superpowers plugin.

## Struktura repa

```
~/.claude/
├── CLAUDE.md                # Globální pravidla — cross-project, vždy platí
├── settings.json            # Status line + hooks + permissions + auto mode
├── theme-config.json        # Konfigurace /theme (default/nerd/plain)
├── levis-wrapper.json       # StatusLine wrapper (lokálně skip-worktree)
├── commands/                # Slash commandy (12×)
├── hooks/                   # Safety + automation hooks (12× Node.js)
├── skills/                  # Vlastní progressive-disclosure skills (10× + trailofbits)
├── agents/                  # Pre-bind subagenti (6×) — dispatch přes subagent_type
├── lib/                     # Sdílené knihovny (theme, git-info, project-info, obsidian-vault)
├── scripts/                 # Helper skripty (statusline, stats, validátory, vault)
├── output-styles/           # Custom output styles
├── docs/historical/         # Archivované dokumenty (refactor report, staré TODO)
└── README.md                # Tento soubor
```

## Pravidla vynucená configem, ne promptem

Část pravidel z CLAUDE.md je zároveň v `settings.json`, aby přežila kompakci
kontextu a nešla obejít omylem:

| Pravidlo | Mechanismus |
|---|---|
| Fable subagentům nedávat | `permissions.deny` → `Agent(model:fable)` |
| Žádné `Co-Authored-By` patičky | `attribution: { commit: "", pr: "" }` |
| Effort `xhigh` (config se používá hlavně na coding) | `effortLevel` |
| Když je opus přetížený, nespadnout | `fallbackModel: ["claude-sonnet-5"]` |
| Nezabíjet procesy podle jména, nespouštět neizolované instance | `autoMode.soft_deny` |

`permissions.defaultMode` je `auto` — classifier posuzuje akce na pozadí místo
slepého průchodu (`bypassPermissions`). Vlastní `autoMode` pravidla se ověřují
přes `claude auto-mode config` a `claude auto-mode critique`; první draft
prakticky vždy potřebuje přepsat na kritérium, které classifier opravdu uvidí.

## Token-aware ecosystem (subagent budget control)

Šetří tokeny tím, že rozhoduje **jaký model** kde použít a **automaticky to vynucuje** přes hooks. Tři vrstvy:

1. **Pravidla v CLAUDE.md** (sekce *Subagent budget*) — routing tabulka haiku/sonnet/opus podle role.
2. **`detect-triggers.js`** (UserPromptSubmit hook) — když user napíše „plán/refactor/agenti/SDD", auto-injectne reminder s routing tabulkou. Nemusíš si pamatovat invokovat skill.
3. **`track-agents.js`** (PreToolUse + PostToolUse na Agent matcher):
   - **PreToolUse** doplní chybějící `model:` parametr podle `subagent_type` + description (Explore → haiku, general-purpose review → sonnet, atd.). Zaznamená dispatch.
   - **PostToolUse** odstraní záznam → status panel přestane ukazovat „live".

Status panel zobrazí 2. řádek `[ main:opus 5 │ live: 2×haiku ]` jen když je co ukázat (default skrytý). Token-aware skill zapisuje plánovaný dispatch do `~/.claude/cache/iq-state.json`, statusline z toho rendruje `plán: …`.

**Parallel batch mode** — default chování SDD: nezávislé tasky paralelně, conflict graph nad target files. Subagenti běží od CC 2.1.195 na pozadí, takže limitem je konflikt souborů, ne počet (měkký strop ~5). Detail v `subagent-driven-development` skill + souhrn v CLAUDE.md.

## Dokumentace projektů → Obsidian

Vault pro dev projekty: `C:\dev\vault` (přepíše `CLAUDE_OBSIDIAN_VAULT`).

`doc-check.js` na SessionStart zjistí, jestli otevřený projekt má poznámku
v `🚀 Projekty/`. Když ne, injektuje pokyn **nabídnout** dokumentaci — ne ji
rovnou psát. Mlčí u ne-startup zdrojů, u složek bez projektových markerů,
u projektů s vlastním Obsidian vaultem a u projektů, kde už uživatel odpověděl.

Odpověď se musí zapsat, jinak se hook ptá při každém startu:

```bash
node ~/.claude/scripts/doc-state.js --skip .           # nechce
node ~/.claude/scripts/doc-state.js --done . "<nota>"  # hotovo
node ~/.claude/scripts/doc-state.js --clear .          # zeptej se zas
```

Samotné psaní řeší skill `obsidian-docs`. Vault se zakládá přes
`node ~/.claude/scripts/vault-init.js` (idempotentní) — Obsidian pak potřebuje
jednorázové *Open folder as vault*, registrace se needituje za běhu aplikace.

## Time-aware kalibrace odhadů

Vrstva nad token-aware ekosystémem — sleduje **skutečné trvání** agent dispatchů a injectuje historical signals do plánovacích promptů, aby model dělal kalibrovanější odhady.

1. **`hooks/log-duration.js`** — modul volaný z `track-agents.js` při Post­ToolUse na Agent. Spočítá `duration_ms`, detekuje status (`completed`/`failed`), korreluje s `auto-tsc.js` snapshot (`tsc_passed_first_try`), appendne JSONL do `logs/agent-durations.jsonl`.
2. **`scripts/duration-stats.js`** — agreguje JSONL per (repo × subagent_type) → median/P90/success_rate/samples za posledních 90 dní (min. 3 vzorky). Zapisuje `cache/duration-stats.json`. Spouští se on-demand i automaticky z log-duration s 30s debounce.
3. **`detect-triggers.js`** (planning trigger) — při „jak dlouho / odhad / naplánuj / how long / estimate" injectne **top 3 nejrelevantnější řádky pro aktuální repo** + případně posledních 5 bullets z `memory/surprises-<repo>.md`. Bez dat: nic.
4. **`/postmortem`** — po dokončeném úkolu zapíše „co bylo nečekané" + estimate vs actual do per-repo memory souboru.

## Slash commandy (`commands/`)

| Command | Co dělá |
|---------|---------|
| `/ctx` | Full Context Load — projekt + git + tsc + TODO + banner |
| `/status` | Kompaktní git + tsc souhrn |
| `/tsc` | TypeScript compile check s kompaktním reportem |
| `/commit` | Český commit workflow s AskUserQuestion |
| `/push` | Bezpečný push (pre-push kontroly, warn na main/master) |
| `/ship` | Commit + push v jednom — jedno potvrzení |
| `/audit` | Bezpečnostní audit s Trail of Bits skills |
| `/visual-audit` | Runtime vizuální audit přes Playwright (web / Electron) |
| `/theme` | Přepne vizuální styl (default / nerd / plain) |
| `/welcome` | Rychlý přehled Claude Code — co umí, kam dál |
| `/postmortem` | Zápis „co bylo nečekané" + estimate vs actual do `memory/surprises-<repo>.md` |
| `/validate-runtime` | Health-check setupu — střílejí hooky, sedí agenti |

## Skills (`skills/`)

Vlastní progressive-disclosure skills — SKILL.md je krátké, detaily v `references/`. Aktivují se automaticky přes Claude Code skill-matching podle `description` (trigger „Use when…").

### Vlastní skills

| Skill | Trigger |
|-------|---------|
| `token-aware` | Před 2+ Agent dispatch nebo plán s subagenty → výběr modelů haiku/sonnet/opus + snapshot pro panel |
| `roadmap` | CZ: „udělej mi roadmapu", „naplánuj appku", „jak to postavit" → workflow Brainstorm → Plan → Execute |
| `electron-security` | Detekce Electron projektu → enforcuje contextIsolation, CSP, IPC discipline |
| `typescript-strict` | Úprava `.ts`/`.tsx` → `any` jen s komentářem proč, preferuje `unknown` |
| `tsc-verification` | Konec série změn v TS projektu → `npx tsc --noEmit` musí projít |
| `i18n-texts` | Úprava UI v projektu s i18n → texty z jazykového souboru, ne hardcoded |
| `design-tokens` | CSS/SCSS/Tailwind v projektu s token systémem → žádné hardcoded hodnoty |
| `visual-audit` | „zkontroluj vzhled", „a11y audit" → runtime screenshot + kontrast + WCAG |
| `security-audit` | „zkontroluj bezpečnost", „bezpečnostní audit" → pairing s `/audit` commandem |
| `obsidian-docs` | Dokumentace projektu do Obsidian vaultu — konvence, formát poznámky, zápis stavu |

### Externí skills

| Zdroj | Kde | Jak nainstalovat |
|-------|-----|------------------|
| **Superpowers** (Anthropic oficiální plugin) | `~/.claude/plugins/cache/claude-plugins-official/superpowers/` | `/plugin install superpowers@claude-plugins-official` |
| **Trail of Bits** (security audity) | `~/.claude/skills/trailofbits/` | Sparse clone — viz sekce *Instalace* |

## Hooks (`hooks/`)

| Hook | Event | Co dělá |
|------|-------|---------|
| `block-destructive.js` | PreToolUse (Bash) | Blokuje `rm -rf /`, `DROP TABLE`, `git push --force`, fork bomb atd. |
| `block-protected.js` | PreToolUse (Write/Edit) | Hard block na `.pem`/`.key`/`.ssh`/`.aws`, ask mode na `.env` |
| `test-gate.js` | PreToolUse (Bash) | Blokuje `git push`, když je `tsc` čerstvě červený (bypass přes `SKIP_TEST_GATE`) |
| `auto-tsc.js` | PostToolUse (Write/Edit) | Spustí `tsc --noEmit` po editu `*.ts/*.tsx`, hlásí jen chyby v edit. souboru |
| `session-context.js` | SessionStart | Injektuje git kontext (branch, ahead/behind, dirty, commity) |
| `doc-check.js` | SessionStart | Projekt bez poznámky v Obsidian vaultu → pokyn nabídnout dokumentaci |
| `session-end.js` | SessionEnd | Zapíše souhrn session (trvání, branch, commity, dirty stav) |
| `pre-compact.js` | PreCompact | Uloží snapshot stavu před kompakcí, ať je po ní čeho se chytit |
| `context-watch.js` | UserPromptSubmit | Varuje na `/compact` při 150k/200k tokenech |
| `detect-triggers.js` | UserPromptSubmit | Scanuje user message na trigger words → injectuje token-aware reminder + time-aware historical signals |
| `track-agents.js` | PreToolUse + PostToolUse (Agent) | Auto-doplní `model:` parametr + sleduje běžící agenty pro status panel + loguje trvání do `agent-durations.jsonl` (přes `log-duration.js`) |
| `log-duration.js` | (modul) | Volaný z `track-agents.js` — spočítá `duration_ms`, status, `tsc_passed_first_try` a appendne JSONL řádek |

## Scripty (`scripts/`)

| Skript | Co dělá |
|--------|---------|
| `statusline.js` | StatusLine renderer (segmenty: project/git/tsc/ctx/limits/cost/mcp/iq) |
| `levis-usage-dump.js` | Wrapper status line → dump usage do `levis-usage.json` pro LevisIDE Hub |
| `ctx-banner.js` | Renderuje `/ctx` banner |
| `agent-stats.js` | Agreguje `logs/agent-decisions.jsonl` — distribuce dispatchů per model |
| `duration-stats.js` | Agreguje `logs/agent-durations.jsonl` per (repo × subagent_type) → `cache/duration-stats.json` (median/P90/success rate) |
| `validate-agents.js` | Ověří frontmatter všech `agents/*.md` (model, tools, popis) |
| `validate-runtime.js` | Health-check — střílejí hooky doopravdy? Sedí pre-bind agenti? |
| `vault-init.js` | Idempotentní založení Obsidian vaultu pro dev projekty |
| `doc-state.js` | Zápis odpovědi na nabídku dokumentace (`--skip`/`--done`/`--clear`/`--status`) |
| `mcp-refresh.js` | Obnova MCP segmentu status line na pozadí |

## Instalace na jiném stroji

```bash
# 1) Clone
cd ~
git clone git@github.com:Levisek/claude.config.git .claude

# 2) Nainstaluj Superpowers plugin (v Claude Code session)
/plugin install superpowers@claude-plugins-official

# 3) Nainstaluj Trail of Bits skills pro /audit
cd ~/.claude/skills
git clone --depth 1 --sparse https://github.com/trailofbits/skills.git trailofbits
cd trailofbits
git sparse-checkout set plugins/static-analysis plugins/semgrep-rule-creator plugins/insecure-defaults plugins/supply-chain-risk-auditor

# 4) Přizpůsob cesty (pokud jsi na jiné platformě než Windows nebo jiný uživatel)
#    settings.json a hooks používají absolutní cesty C:/Users/admin/.claude/...
```

## Update workflow

V Claude Code session použij `/ship` — udělá commit + push v jednom.

Nebo ručně:
```bash
cd ~/.claude && git add -A && git commit -m "feat/fix/docs: <popis>" && git push
```

## Co NENÍ v repu (schválně)

Zablokováno přes `.gitignore`:

- **Citlivé:** `.credentials.json`, `*.token`, `*.pem`, `*.key`, `id_rsa*`
- **Session data:** `history.jsonl`, `sessions/`, `projects/`, `file-history/`, `paste-cache/`, `shell-snapshots/`, `backups/`, `telemetry/`, `downloads/`, `tasks/`, `plans/`, `cache/`
- **Lokální stav:** `levis-usage.json`, `*.log`, `*-usage.json`, `session-env/`, `.last-cleanup`
- **Plugins:** `plugins/` — instaluje se přes CC marketplace
- **External skills:** `skills/trailofbits/` — sparse clone (viz *Instalace*)
- **Node modules:** `skills/visual-audit/scripts/node_modules/`, `runner/node_modules/`
- **Logy:** `logs/agent-decisions.jsonl`

## Známá upozornění

- **`settings.json` obsahuje absolutní cesty** `C:/Users/admin/.claude/...` — na jiném stroji/uživateli upravit.
- **Hooks jsou Node.js skripty** — na cílovém stroji musí být Node v PATH.
- **`/audit` vyžaduje Trail of Bits skills** (viz instalace bod 3).
- **`/audit` se Semgrepem** vyžaduje Python + `pipx install semgrep`.
- **`/visual-audit`** vyžaduje Playwright + Chromium — při prvním spuštění se doinstaluje.
- **`roadmap` skill deleguje na Superpowers skills** — bez Superpowers pluginu nefunguje celý workflow.
- **`levis-wrapper.json`** může mít hardcoded path na lokální stroj — pokud commit zobrazuje rozdíl, tracked verze je správná, lokální override `git update-index --skip-worktree levis-wrapper.json`.

## Historie

- `docs/historical/REFACTOR-REPORT-2026-04-17.md` — refaktor monolitické CLAUDE.md do progressive-disclosure skills
- `docs/historical/TODO-2026-04-14.md` — TODO list před refaktorem
- `docs/historical/CLAUDE.md.pre-refactor-2026-04-17.md` — CLAUDE.md před refaktorem
