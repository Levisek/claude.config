# Claude Code — osobní config

Globální Claude Code setup pro Windows: CLAUDE.md pravidla, slash commandy, hooks, skills (vlastní + externí) a integrace se Superpowers plugin.

## Struktura repa

```
~/.claude-config/            (↔ synchronizuje se s ~/.claude/)
├── CLAUDE.md                # Globální pravidla — cross-project, vždy platí
├── settings.json            # Status line + hooks registrace
├── commands/                # Slash commandy (11×)
├── hooks/                   # Safety + automation hooks (5× Node.js)
├── skills/                  # Vlastní progressive-disclosure skills (8×)
├── lib/                     # Sdílené knihovny pro hooks/commandy
├── scripts/                 # Helper skripty
├── output-styles/           # Custom output styles
├── backup/                  # Zálohy CLAUDE.md před refaktorem
├── theme-config.json        # Konfigurace /theme (default/nerd/plain)
├── REFACTOR-REPORT.md       # Historie refaktoru 2026-04-17
├── TODO.md                  # Rozpracované / backlog
└── README.md                # Tento soubor
```

## Slash commandy (`commands/`)

| Command | Co dělá |
|---------|---------|
| `/iq` | Přepínač reasoning effort (60/75/99) |
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

## Skills (`skills/`)

Vlastní progressive-disclosure skills — SKILL.md je krátké (< 80 ř.), detaily v `references/`. Aktivují se automaticky přes Claude Code skill-matching podle `description` (trigger „Use when…").

### Vlastní skills

| Skill | Trigger |
|-------|---------|
| `roadmap` | CZ: „udělej mi roadmapu", „naplánuj appku", „jak to postavit" → workflow Brainstorm → Plan → Execute s hard gates |
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
| **Superpowers** (Jesse Vincent, oficiální Anthropic plugin) | `~/.claude/plugins/…` | `/plugin install superpowers@claude-plugins-official` |
| **Trail of Bits** (security audity) | `~/.claude/skills/trailofbits/` | Sparse clone — viz sekce *Instalace* |

## Hooks (`hooks/`)

| Hook | Event | Co dělá |
|------|-------|---------|
| `block-destructive.js` | PreToolUse (Bash) | Blokuje `rm -rf /`, `DROP TABLE`, `git push --force`, fork bomb atd. |
| `block-protected.js` | PreToolUse (Write/Edit) | Hard block na `.pem`/`.key`/`.ssh`/`.aws`, ask mode na `.env` |
| `auto-approve-read.js` | PreToolUse (Read/Glob/Grep) | Auto-approve read-only operací |
| `auto-tsc.js` | PostToolUse (Write/Edit) | Spustí `tsc --noEmit` po editu `*.ts/*.tsx`, hlásí jen chyby v edit. souboru |
| `session-context.js` | SessionStart | Injektuje git kontext (branch, ahead/behind, dirty, commity) |

## Instalace na jiném stroji

```bash
# 1) Clone
cd ~
git clone git@github.com:Levisek/claude-config.git .claude-config

# 2) Zkopíruj config do ~/.claude/
mkdir -p ~/.claude
cp -r ~/.claude-config/CLAUDE.md \
      ~/.claude-config/settings.json \
      ~/.claude-config/theme-config.json \
      ~/.claude-config/commands \
      ~/.claude-config/hooks \
      ~/.claude-config/skills \
      ~/.claude-config/lib \
      ~/.claude-config/scripts \
      ~/.claude-config/output-styles \
      ~/.claude-config/TODO.md \
      ~/.claude/

# 3) Nainstaluj Superpowers plugin (v Claude Code session)
/plugin install superpowers@claude-plugins-official

# 4) Nainstaluj Trail of Bits skills pro /audit
cd ~/.claude/skills
git clone --depth 1 --sparse https://github.com/trailofbits/skills.git trailofbits
cd trailofbits
git sparse-checkout set plugins/static-analysis plugins/semgrep-rule-creator plugins/insecure-defaults plugins/supply-chain-risk-auditor

# 5) Status line (volitelně — cesta v settings.json je hardcoded na C:/dev/...)
# Edituj ~/.claude/settings.json → uprav nebo odstraň sekci "statusLine"
```

## Update workflow

```bash
# Na stroji kde jsi něco změnil — sync z ~/.claude/ do repa:
cd ~/.claude-config
cp -r ~/.claude/CLAUDE.md \
      ~/.claude/settings.json \
      ~/.claude/theme-config.json \
      ~/.claude/commands \
      ~/.claude/hooks \
      ~/.claude/skills \
      ~/.claude/lib \
      ~/.claude/scripts \
      ~/.claude/output-styles \
      ~/.claude/TODO.md \
      .

git add -A && git status
# Zkontroluj že .gitignore blokuje citlivé věci (viz níže).
git commit -m "feat/fix/docs: <popis>"
git push

# Na druhém stroji:
cd ~/.claude-config && git pull
cp -r CLAUDE.md settings.json theme-config.json commands hooks skills lib scripts output-styles TODO.md ~/.claude/
```

Nebo v Claude Code session použij `/ship` — udělá commit + push v jednom.

## Co NENÍ v repu (schválně)

Zablokováno přes `.gitignore`:

- **Citlivé:** `.credentials.json`, `*.token`, `*.pem`, `*.key`, `id_rsa*`
- **Session data:** `history.jsonl`, `sessions/`, `projects/`, `file-history/`, `paste-cache/`, `shell-snapshots/`, `backups/`, `telemetry/`, `downloads/`, `tasks/`, `plans/`, `cache/`
- **Lokální stav:** `levis-usage.json`, `*.log`, `*-usage.json`, `session-env/`
- **Plugins:** `plugins/` — instaluje se přes CC marketplace (Superpowers atd.)
- **External skills:** `skills/trailofbits/` — pokyny pro re-install v sekci *Instalace*
- **Node modules:** `skills/visual-audit/scripts/node_modules/`, `package-lock.json`

## Známá upozornění

- **`settings.json` obsahuje absolutní cestu** `C:/dev/levis-ide/scripts/statusline-dump.js` — na jiném stroji upravit nebo odstranit `statusLine` sekci.
- **Hooks jsou Node.js skripty** — na cílovém stroji musí být Node v PATH.
- **`/audit` vyžaduje Trail of Bits skills** (viz instalace bod 4).
- **`/audit` se Semgrepem** vyžaduje Python + `pipx install semgrep`.
- **`/visual-audit`** vyžaduje Playwright + Chromium — při prvním spuštění se doinstaluje.
- **`roadmap` skill deleguje na Superpowers skills** — bez Superpowers pluginu nefunguje celý workflow (brainstorming, writing-plans, executing-plans).
- **`SessionStart` hook** `session-context.js` obohacuje každou novou session o git status — pokud není git repo, tiše to přeskočí.
