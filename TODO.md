# TODO — Claude Code globální setup

> Soubor není načítaný Claudem (není to CLAUDE.md). Jen poznámky pro tebe.

## ✅ Hotovo

- [x] Globální `CLAUDE.md` (reasoning 99, CZ, základní pravidla, architektura, commit workflow)
- [x] Slash command `/iq` (přepínač reasoning 60/75/99)
- [x] Slash command `/tsc` (compile check)
- [x] Slash command `/commit` (český commit workflow s AskUserQuestion)
- [x] Slash command `/push` (bezpečný push, pre-push kontroly, warn na main/master)
- [x] Slash command `/status` (git + tsc souhrn)
- [x] Hook **block-destructive** (rm -rf /, DROP TABLE, git push --force, fork bomb…)
- [x] Hook **block-protected** (.pem, .key, id_rsa, .ssh/, .aws/credentials — hard block; .env — ask)
- [x] Hook **auto-approve-read** (Read/Glob/Grep bez promptů)
- [x] Hook **auto-tsc** (PostToolUse *.ts/*.tsx, timeout 20 s, reportuje jen chyby v edit. souboru)
- [x] Hook **session-context** (SessionStart: branch, ahead/behind, dirty, posl. 3 commity)

## 🔜 Priorita 2 — Otestovat jeden external skill set

Nestahovat všechno, jen jeden jako experiment.

- [ ] **Superpowers (Jesse Vincent)** — general productivity, planning→testing→debugging
  - Repo: https://github.com/obra/superpowers
  - Postup: `git clone` do `~/.claude/skills/superpowers`, prozkoumat co nabízí, vyhodit co nepoužívám
- [ ] **NEBO Trail of Bits Skills** — security audity (XSS, variant analysis, CodeQL/Semgrep)
  - Repo: https://github.com/trailofbits/skills
  - Použití: pro audity LevisIDE a gral-web-builder

**Rozhodovací strom:** pokud nejčastěji refaktoruju/debuguju → Superpowers. Pokud dělám security review → Trail of Bits.

## 🔜 Priorita 3 — Session continuity

- [ ] **claude-session-restore**
  - Repo: https://github.com/ZENG3LD/claude-session-restore
  - Kdy nasadit: až budu mít delší projekt, kde session shoří a chci pokračovat

## 🟡 Další kandidáti ze původního brainstormingu (implementovat až narazím na potřebu)

### Quality & audit commandy
- [ ] `/audit` — XSS, innerHTML bez escape, hardcoded secrets, memory leaks, `any`. Inspirace: LevisIDE commit `d9ffaad`
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

- [ ] Rozhodnout sync strategii (viz níže):
  - **A)** Git repo `~/.claude-config` → clone + symlink
  - **B)** OneDrive/cloud folder → zkopírovat potřebné soubory
  - **C)** Mega install prompt → paste do Claude, on to vygeneruje

## Poznámky k údržbě

- Pokud některý hook zlobí → v `settings.json` zakomentuj jeho entry a restart
- Hook logy nejsou nikde — debug přes `echo '{"..."}' | node hooks/xxx.js`
- TSC timeout 20 s — pokud velké projekty timeoutují, zvedni v `auto-tsc.js`
- CLAUDE.md v projektu má přednost před globálním (loads after)
