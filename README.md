# Claude Code — osobní config

Globální Claude Code setup: pravidla, slash commandy, hooks a skills.

## Struktura

```
~/.claude/
├── CLAUDE.md              # Globální pravidla (reasoning, komunikace, workflow)
├── settings.json          # Status line + hooks registrace
├── commands/              # Slash commandy (/iq, /tsc, /commit, /push, /status, /audit, /ctx)
├── hooks/                 # Safety + automation hooks (Node.js)
└── TODO.md                # Co je hotovo / co zbývá
```

## Co je v repu

**Slash commandy** (`~/.claude/commands/`)

| Command | Co dělá |
|---------|---------|
| `/iq` | Přepínač reasoning effort (60/75/99) |
| `/tsc` | TypeScript compile check s kompaktním reportem |
| `/commit` | Český commit workflow s AskUserQuestion |
| `/push` | Bezpečný push (pre-push kontroly, warn na main/master) |
| `/status` | Git + tsc souhrn v jednom pohledu |
| `/audit` | Bezpečnostní audit s Trail of Bits skills (insecure-defaults, supply-chain, semgrep) |
| `/ctx` | Full Context Load — projekt identifikace + git + tsc + TODO |

**Hooks** (`~/.claude/hooks/`)

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

# 2) Zkopíruj potřebné soubory do ~/.claude/
mkdir -p ~/.claude
cp -r ~/.claude-config/CLAUDE.md \
      ~/.claude-config/settings.json \
      ~/.claude-config/commands \
      ~/.claude-config/hooks \
      ~/.claude-config/TODO.md \
      ~/.claude/

# 3) (Volitelně) Nainstaluj Trail of Bits skills pro /audit
cd ~/.claude
mkdir -p skills && cd skills
git clone --depth 1 --sparse https://github.com/trailofbits/skills.git trailofbits
cd trailofbits
git sparse-checkout set plugins/static-analysis plugins/semgrep-rule-creator plugins/insecure-defaults plugins/supply-chain-risk-auditor

# 4) Status line (pokud chceš — cesta se musí upravit dle lokální instalace)
# Edituj ~/.claude/settings.json a uprav cestu v statusLine.command
```

## Update workflow

```bash
# Na stroji, kde jsi něco změnil:
cd ~/.claude-config
cp -r ~/.claude/CLAUDE.md ~/.claude/settings.json ~/.claude/commands ~/.claude/hooks ~/.claude/TODO.md .
git add -A && git commit -m "update: <popis>" && git push

# Na druhém stroji:
cd ~/.claude-config && git pull
cp -r CLAUDE.md settings.json commands hooks TODO.md ~/.claude/
```

## Co NENÍ v repu (schválně)

- `.credentials.json` — auth tokeny
- `history.jsonl`, `sessions/`, `projects/`, `file-history/` — kompletní chat historie s kódem
- `levis-usage.json` — API usage tracking
- `plugins/` — instaluje se přes CC marketplace
- `skills/trailofbits/` — external clone (pokyny pro re-install výše)

Vše zablokováno přes `.gitignore`.

## Známá upozornění

- `settings.json` odkazuje na absolutní cestu `C:/dev/levis-ide/scripts/statusline-dump.js` — na jiném stroji upravit nebo odstranit `statusLine` sekci
- Hooks jsou Node skripty — na cílovém stroji musí být Node v PATH (většina dev stanic to má)
- `/audit` vyžaduje Trail of Bits skills (viz instalace bod 3)
- `/audit` s Semgrep enginem vyžaduje Python + `pipx install semgrep`
