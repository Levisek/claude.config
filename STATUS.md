# Globální Claude Code config — current status

**Last updated:** 2026-05-19 (admin machine session)
**Repo:** `~/.claude/` synced to `github.com/Levisek/claude.config`

## PDF Native Orchestration roll-out — phases

### ✅ Sub-projekt A — Subagent fleet (commit `cc8bb9c`, shipped)

6 pre-bind agents v `~/.claude/agents/*.md`:
- `implementer-mech` (haiku) — 1-2 file mechanical
- `implementer-multi` (sonnet) — multi-file
- `spec-reviewer` (haiku) — deterministic spec↔code
- `code-reviewer` (sonnet) — quality/smells judgment
- `dead-code-scanner` (haiku) — unused exports
- `architect` (opus) — design ADR

Plus: `hooks/detect-triggers.js` reminder + `skills/token-aware/SKILL.md` updated.

### ✅ Sub-projekt B — Activation & dietetics (commit `fcf9606`, shipped)

- `claudeMdExcludes` (3 patterns)
- Source-aware SessionStart diet (resume/clear: 80 chars vs startup: 1154)
- 3 conservative skill hint triggers v detect-triggers

### ✅ Sub-projekt C — Memory lifecycle (commit `bb97791`, shipped)

- `lib/repo-path.js` encoder
- SessionStart marker + SessionEnd log writer
- PreCompact state snapshot + compact replay
- test-gate na `git push` (z auto-tsc cache)

### ✅ D1 — Path portability (commit `797d9cd`, shipped)

Settings.json používá `$HOME/.claude/...` místo hardcoded `levingerm` paths. Hot-reload fungoval — statusline + hooks fungují cross-machine.

### ✅ D2 — CLAUDE.md sync (commit `c8315d7`, shipped)

Subagent budget sekce sjednocená s pre-bind agent names. Pre-bind pointer přidán do skills list.

### ✅ D3 — validate-runtime health-check (commit `19d8f5b`, shipped)

`scripts/validate-runtime.js` + `/validate-runtime` slash command. Investigation finding: Anthropic Agent enum loads at session start (not hot-reloaded jako settings/commands).

## ⚠️ Critical post-restart verification

**Pre-bind agents byly vytvořeny v session co teď probíhá. Anthropic NEZNÁ je dokud nezrestartuješ Claude Code.**

Po restartu + `git pull`, zkus toto:

```
Agent(subagent_type: "implementer-mech", description: "smoke test", prompt: "Respond OK only")
```

- ✅ Pokud odpoví "OK" → Sub-projekt A delivers cost saving as designed
- ❌ Pokud "Agent type not found" → bug v Anthropic harness / PDF claim není pravdivý → investigation needed

## D4-D7 — pending

- **D4** — CI workflow (`.github/workflows/test.yml` co spouští 8 testů na push/PR)
- **D5** — Memory log rotation (auto-rotate `session-log.md` při >100 KB nebo >50 entries)
- **D6** — Test-gate scope review (gate také `git commit`? lint?)
- **D7** — Deeper skill activation (proactive injection nebo auto-dispatch) — možná skip pokud diminishing returns

## Quick links

- Specs: `docs/superpowers/specs/2026-05-19-*-design.md` (A, B, C, B-activation, C-memory)
- Plans: `docs/superpowers/plans/2026-05-19-*.md`
- Health-check: `node scripts/validate-runtime.js` nebo `/validate-runtime`

## Known limitations

- `projects/`, `cache/`, `logs/*.jsonl` jsou gitignored → session-log entries z admin stroje se nesyncnou na levingerm (každý stroj má vlastní log historii)
- `settings.local.json` je gitignored (per-machine override mechanismus dostupný pokud `$HOME` někdy přestane fungovat)
- 3 ze 4 audit-fixes z `db845f8` (před D1) — admin/levingerm rename — nahrazeny `$HOME` přístupem
