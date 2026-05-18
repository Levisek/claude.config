# Claude Code — osobní config

Globální Claude Code setup pro Windows: CLAUDE.md pravidla, slash commandy, hooks, skills (vlastní + externí) a integrace se Superpowers plugin.

## Struktura repa

```
~/.claude/
├── CLAUDE.md                # Globální pravidla — cross-project, vždy platí
├── settings.json            # Status line + hooks + permissions
├── theme-config.json        # Konfigurace /theme (default/nerd/plain)
├── levis-wrapper.json       # StatusLine wrapper (lokálně skip-worktree)
├── commands/                # Slash commandy (10×)
├── hooks/                   # Safety + automation hooks (7× Node.js)
├── skills/                  # Vlastní progressive-disclosure skills (9×)
├── lib/                     # Sdílené knihovny (theme, git-info, project-info)
├── scripts/                 # Helper skripty (statusline + agent-stats)
├── output-styles/           # Custom output styles
├── docs/historical/         # Archivované dokumenty (refactor report, staré TODO)
└── README.md                # Tento soubor
```

## Token-aware ecosystem (subagent budget control)

Šetří tokeny tím, že rozhoduje **jaký model** kde použít a **automaticky to vynucuje** přes hooks. Tři vrstvy:

1. **Pravidla v CLAUDE.md** (sekce *Subagent budget*) — routing tabulka haiku/sonnet/opus podle role.
2. **`detect-triggers.js`** (UserPromptSubmit hook) — když user napíše „plán/refactor/agenti/SDD", auto-injectne reminder s routing tabulkou. Nemusíš si pamatovat invokovat skill.
3. **`track-agents.js`** (PreToolUse + PostToolUse na Agent matcher):
   - **PreToolUse** doplní chybějící `model:` parametr podle `subagent_type` + description (Explore → haiku, general-purpose review → sonnet, atd.). Zaznamená dispatch.
   - **PostToolUse** odstraní záznam → status panel přestane ukazovat „live".

Status panel zobrazí 2. řádek `[ main:opus 4.7 │ live: 2×haiku ]` jen když je co ukázat (default skrytý). Token-aware skill zapisuje plánovaný dispatch do `~/.claude/cache/iq-state.json`, statusline z toho rendruje `plán: …`.

**Parallel batch mode** — default chování SDD: 3 nezávislé tasky paralelně, conflict graph nad target files. Detail v `subagent-driven-development` skill + souhrn v CLAUDE.md.

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
| `auto-approve-read.js` | PreToolUse (Read/Glob/Grep) | Auto-approve read-only operací |
| `auto-tsc.js` | PostToolUse (Write/Edit) | Spustí `tsc --noEmit` po editu `*.ts/*.tsx`, hlásí jen chyby v edit. souboru |
| `session-context.js` | SessionStart | Injektuje git kontext (branch, ahead/behind, dirty, commity) |
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
