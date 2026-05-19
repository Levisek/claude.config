---
allowed-tools: Bash
description: Runtime health-check pro Claude Code hooks + pre-bind agents readiness
---

Spustí `~/.claude/scripts/validate-runtime.js` který zobrazí status všech hooks (track-agents, log-duration, auto-tsc, session-context, session-end, detect-triggers, pre-compact, test-gate) a pre-bind agent souborů. Reportuje ✅ pokud hook recently fired, ⚠️ pro optional/no-activity, ❌ pro broken setup.

Run: `!node ~/.claude/scripts/validate-runtime.js`
