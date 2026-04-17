# TODO — Claude Code globální setup

> Soubor není načítaný Claudem (není to CLAUDE.md). Jen poznámky pro tebe.

## ✅ Hotovo

### Core
- [x] Globální `CLAUDE.md` (reasoning 99, CZ, architektura, commit workflow, procesy & instance)
- [x] `settings.json` (status line + 5 hooks)
- [x] `theme-config.json` + `/theme` přepínač (default / nerd / plain)

### Slash commandy
- [x] `/iq` — přepínač reasoning 60/75/99
- [x] `/tsc` — TypeScript compile check
- [x] `/commit` — český commit workflow s AskUserQuestion
- [x] `/push` — bezpečný push (pre-push kontroly, warn na main/master)
- [x] `/status` — git + tsc souhrn
- [x] `/ctx` — Full Context Load (projekt + git + tsc + TODO)
- [x] `/audit` — security audit s Trail of Bits skills (insecure-defaults, supply-chain, semgrep)
- [x] `/ship` — end-to-end release workflow
- [x] `/theme` — přepínač vizuálního stylu
- [x] `/visual-audit` — runtime vizuální audit webů a Electron apek
- [x] `/welcome` — uvítací banner

### Hooks
- [x] **block-destructive** (rm -rf /, DROP TABLE, git push --force, fork bomb…)
- [x] **block-protected** (.pem, .key, id_rsa, .ssh/, .aws/credentials — hard block; .env — ask)
- [x] **auto-approve-read** (Read/Glob/Grep bez promptů)
- [x] **auto-tsc** (PostToolUse *.ts/*.tsx, timeout 20 s, reportuje jen chyby v edit. souboru)
- [x] **session-context** (SessionStart: branch, ahead/behind, dirty, posl. 3 commity)

### Skills
- [x] `visual-audit` (runner, checklist, electron config, report template)

### Output styles
- [x] `compact-boxed` — rámečky a minimum žvatlání

## 🔜 Priorita 1 — Portabilita instalace

Aktuálně `settings.json`, `commands/audit.md` a `commands/theme.md` obsahují absolutní cesty s konkrétním username (`C:/Users/levingerm/...`). Při cloneu na jiný stroj se to musí ručně přepsat.

- [ ] **Install skript** (`scripts/install.sh` nebo `install.mjs`)
  - Detekuje `$USERPROFILE` / `$HOME`
  - Přepíše všechny absolutní cesty v `settings.json`, `commands/audit.md`, `commands/theme.md`
  - Zkopíruje soubory do `~/.claude/`
  - Idempotentní (bezpečné pustit víckrát)
- [ ] **NEBO** — refaktor na relativní cesty / env var
  - Status line: `node $CLAUDE_HOME/scripts/statusline.js`
  - Hooks: stejná varianta
  - Claude Code umí expandovat env vary v `settings.json`? → ověřit

## 🔜 Priorita 2 — Trail of Bits skills

`/audit` odkazuje na `~/.claude/skills/trailofbits/plugins/...` ale repo je neobsahuje (schválně, jsou to external clone).

- [ ] Přidat do `scripts/install.sh` sparse clone ToB skills:
  ```
  git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/trailofbits/skills.git ~/.claude/skills/trailofbits
  cd ~/.claude/skills/trailofbits
  git sparse-checkout set plugins/static-analysis plugins/semgrep-rule-creator \
    plugins/insecure-defaults plugins/supply-chain-risk-auditor
  ```
- [ ] V `audit.md` graceful fallback pokud skills chybí (aktuálně by Read spadl)
  - Detekovat existenci `~/.claude/skills/trailofbits/` a pokud chybí → jen univerzální checky + hint na install

## 🔜 Priorita 3 — Další external skill sets

Nestahovat všechno, jen po jednom jako experiment.

- [ ] **Superpowers (Jesse Vincent)** — general productivity, planning→testing→debugging
  - Repo: https://github.com/obra/superpowers
  - Postup: `git clone` do `~/.claude/skills/superpowers`, prozkoumat co nabízí, vyhodit co nepoužívám

**Rozhodovací strom:** nejčastěji refaktoruju/debuguju → Superpowers. Security review → Trail of Bits (už v pipeline).

## 🔜 Priorita 4 — Session continuity

- [ ] **claude-session-restore**
  - Repo: https://github.com/ZENG3LD/claude-session-restore
  - Kdy nasadit: až budu mít delší projekt, kde session shoří a chci pokračovat

## 🟡 Další kandidáti ze původního brainstormingu (implementovat až narazím na potřebu)

### Quality & audit commandy
- [ ] `/review` — projede poslední diff proti CLAUDE.md pravidlům
- [ ] `/secrets` — hledá API klíče v repo (git log i current)
- [ ] `/deadcode` — nepoužívané exporty/importy
- [ ] `/race` — AST scan `Promise.race` / `setTimeout` bez AbortController

### Přepínače stylu
- [ ] `/terse` — ultra krátké odpovědi
- [ ] `/verbose` — detail mode
- [ ] `/en` — dočasně EN (pro error messages od knihoven)

### Workflow
- [ ] `/build` — detekce projekt typu (Electron/Expo/Vite) a správný build command
- [ ] `/dev` — spustí dev server na pozadí
- [ ] `/build-all` — multi-platform Electron (win + mac + linux)
- [ ] `/cleanup` — smaž `dist/`, `.levis-tmp/`, `node_modules/.vite` s potvrzením

### Advanced hooks (jen pokud narazím na potřebu)
- [ ] **Auto-format (Prettier)** na PostToolUse Write/Edit — jen pokud začnu používat Prettier
- [ ] **Stop hook code review** — LLM projede diff před koncem session
- [ ] **Rate-limit MCP tools** — pokud někdy narazím na nekonečné smyčky

## 🏠 Domácí setup — jednou provést

- [x] Sync strategie: **A) Git repo** `Levisek/claude.config` → clone + kopírování přes install skript
- [ ] Dotáhnout install skript (viz Priorita 1) ať je „clone → spustit → hotovo"

## Poznámky k údržbě

- Pokud některý hook zlobí → v `settings.json` zakomentuj jeho entry a restart
- Hook logy nejsou nikde — debug přes `echo '{"..."}' | node hooks/xxx.js`
- TSC timeout 20 s — pokud velké projekty timeoutují, zvedni v `auto-tsc.js`
- CLAUDE.md v projektu má přednost před globálním (loads after)
- Po editaci commandu/hooku/CLAUDE.md → restart session pro reload
