---
name: security-audit
description: Use when the user asks for a security review, vulnerability scan, OWASP check, secrets audit, dependency audit, or uses Czech phrases "zkontroluj bezpečnost", "bezpečnostní audit", "najdi zranitelnosti", "projdi secrets", "audit deps". Trigger also when user pastes suspect code asking "je to bezpečné?" or mentions hardcoded credentials, eval(), innerHTML with user data, or unsafe defaults. Do NOT use for visual/UI audit (that's `visual-audit`), performance audit, code style review, or general code review without security focus.
allowed-tools: Bash, Read, Grep, Glob
---

# Security Audit — mindset & triage

Když user chce bezpečnost zkontrolovat, máš dva nástroje:

## 1. Plný audit = `/audit` command

Existuje slash command `/audit` (v `~/.claude/commands/audit.md`), který:
- Detekuje typ projektu (Electron/TS, Node, vanilla HTML, Python)
- Zeptá se na scope (plný / rychlý / supply chain / custom)
- Používá Trail of Bits skills (viz níže)
- Kategorizuje nálezy (CRITICAL / HIGH / MEDIUM / INFO)

**Když user chce komplexní audit**, navrhni spuštění `/audit`. Nestartuj paralelní workflow sám.

## 2. Inline review = tato skill

Pro quick security-mindset check v rámci normální konverzace (user ukáže kus kódu, nebo se ptá „je to bezpečné?") použij:
- `references/quick-triage.md` — checklist top-20 věcí k projetí
- `references/secret-patterns.md` — regex patterny pro hardcoded secrets

Tyto kontroly dělej inline, výsledky nahlas `file:line` + severity.

## Trail of Bits skills (lokálně sparse-clone v `~/.claude/skills/trailofbits/`)

| Plugin | Použití |
|--------|---------|
| `insecure-defaults` | Fail-open defaults, weak auth, permissive CORS, disabled security |
| `supply-chain-risk-auditor` | `package.json` deps: unmaintained, typosquatting, single maintainer |
| `static-analysis/semgrep` | Semgrep s rulesety (p/typescript, p/nodejs-scan) — vyžaduje `semgrep --version` |
| `semgrep-rule-creator` | Custom Semgrep pravidla pro projekt |

Před spuštěním Semgrep scanu získej od uživatele explicit approval plánu (TOB doporučení).

## Pravidla

- **Neskenuj `node_modules/`, `dist/`, `build/`, `.git/`** — build artifacts.
- **Ignoruj test/spec/example soubory** — false positives převažují.
- **False-positive check** — nejsi-li si jistý, `[NEEDS REVIEW]` místo `[CRITICAL]`.
- **Nefixuj automaticky** — user rozhodne co opravit.
- **Rozliš fail-open vs fail-secure** — `env.KEY || 'default'` pro auth = kritické; pro logger prefix = OK.

## Kategorie severity

- **CRITICAL** — aktivně exploitable (hardcoded secrets v HEAD, SQL injection, RCE)
- **HIGH** — security-relevant (XSS vector, fail-open auth, disabled CSP)
- **MEDIUM** — best-practice breach (missing CSP, weak defaults)
- **INFO** — observabilita, dokumentace

## Když nejistý scope

Zeptej se přes AskUserQuestion: „Rychlý triage" / „Plný audit (`/audit`)" / „Jen konkrétní soubor".
