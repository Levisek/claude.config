# Subagent Fleet — Design Spec

**Date:** 2026-05-19
**Status:** Draft → user review pending
**Sub-projekt:** A z trojice {A: Subagent fleet, B: Activation & dietetics, C: Memory lifecycle}
**Cíl:** Token saving přes pre-bind subagenty s pevným model + tools + role promptem.

---

## 1. Motivace

PDF *Claude Code Native Orchestration & Automation (May 2026)* dokumentuje, že
`.claude/agents/*.md` definice jsou first-class primitivem — orchestrator je
vybírá podle `description:` pole a per-agent `model:` field eliminuje opakované
explicit-model parametry v každém `Agent` tool callu.

Současně CLAUDE.md `Subagent budget` sekce už definuje routing pravidla
(haiku/sonnet/opus per role), ale **každý dispatch je ad-hoc**: orchestrator
volí model parametrem, role description v promptu, tools v allowed-tools. To
znamená:

- Routing tabulka existuje jen v CLAUDE.md (≈30 řádků context per session).
- Per-dispatch prompt obsahuje role description (cca 100-200 tokenů opakovaně).
- Riziko zapomenout `model: "haiku"` → inherit opus → 5-10× cena.

Pre-bind subagenty řeší všechny tři.

## 2. Scope (in / out)

**In scope:**

- 6 souborů v `~/.claude/agents/*.md`.
- Update `~/.claude/hooks/detect-triggers.js` — reminder text odkazuje konkrétní agent names.
- Update `~/.claude/skills/token-aware/SKILL.md` — routing tabulka uvádí agent names.

**Out of scope (jiné sub-projekty):**

- Skill activation hook (B).
- `claudeMdExcludes` (B).
- PreCompact / SessionEnd lifecycle (C).
- Test-gate na git commit (C).
- `context: fork` flag — odložené (experimental, nestabilní).

## 3. Architektura

```
~/.claude/agents/
  implementer-mech.md      (haiku)
  implementer-multi.md     (sonnet)
  spec-reviewer.md         (haiku)
  code-reviewer.md         (sonnet)
  dead-code-scanner.md     (haiku)
  architect.md             (opus)

Aktualizováno:
~/.claude/hooks/detect-triggers.js
~/.claude/skills/token-aware/SKILL.md
```

**Data flow při dispatchi:**

1. User pošle prompt obsahující trigger ("rozdělej to", "naplánuj").
2. `detect-triggers.js` (UserPromptSubmit hook) injektuje reminder s konkrétními agent names.
3. Orchestrator si vybere agenta jménem (např. `subagent_type: "implementer-mech"`).
4. Anthropic resolver: env `CLAUDE_CODE_SUBAGENT_MODEL` (není nastaven) > per-invocation `model:` parameter (může overridovat) > frontmatter `model: haiku` → haiku.
5. Subagent dostane fresh context window + system prompt z markdown body + user prompt z Agent tool call.

## 4. Per-agent specs

Každý soubor následuje schéma:

```markdown
---
name: <name>
description: <when to use, model-invocable hint>
model: <haiku|sonnet|opus>
tools: <comma list>
---

<role v 1 větě>

<scope limits>

<output kontrakt>

<escalation pravidla>
```

### 4.1 `implementer-mech.md` — haiku

- **Description:** "Mechanical implementation in 1-2 files when an exact spec is given. Use when changes are deterministic (rename, typo, single-function edit, format)."
- **Tools:** `Read, Edit, Bash`
- **Role:** Apply a precise change spec. No design decisions, no scope expansion.
- **Output:** Summary line + list of edited files. Max 200 words.
- **Escalation:** Return `BLOCKED: <reason>` if spec is ambiguous or files don't exist. Return `NEEDS_CONTEXT: <what>` if dependencies need exploration.

### 4.2 `implementer-multi.md` — sonnet

- **Description:** "Multi-file implementation requiring coordination across boundaries. Use for integrations, refactors touching 3+ files, or when spec needs interpretation."
- **Tools:** `Read, Edit, Bash, Grep, Glob`
- **Role:** Implement coordinated change. Maintain invariants across files.
- **Output:** Summary + edited file list + key decisions taken. Max 400 words.
- **Escalation:** `BLOCKED` / `NEEDS_CONTEXT` keywords stejně jako mech.

### 4.3 `spec-reviewer.md` — haiku

- **Description:** "Deterministic spec ↔ code comparison. Use after implementer finishes to verify every spec requirement landed."
- **Tools:** `Read, Grep, Glob`
- **Role:** Walk through spec section by section, find corresponding code, report match status.
- **Output:** Header `PASS` nebo `FAIL`, list mismatches s line refs. Žádný subjective judgment.
- **Escalation:** `BLOCKED` pokud spec není file (např. v promptu jen vágně).

### 4.4 `code-reviewer.md` — sonnet

- **Description:** "Code quality review — smells, bugs, security issues, style consistency. Use after implementation to catch what spec-reviewer's mechanical check misses."
- **Tools:** `Read, Grep, Glob`
- **Role:** Prioritized issue list. Není to spec-check, je to judgment-based review.
- **Output:** Issues groupované do `BLOCKER / HIGH / MEDIUM / NIT` s file:line refs.
- **Escalation:** Žádná — review je vždy možná, max vrátí "no issues found".

### 4.5 `dead-code-scanner.md` — haiku

- **Description:** "Find unused exports, imports, and functions. Use after refactors or on schedule."
- **Tools:** `Read, Grep, Glob`
- **Role:** Mechanical pattern matching pro unreachable symbols. TS/JS aware.
- **Output:** Tabulka `file:line | symbol | confidence (high/medium)`. Confidence = nikdo neimportuje (high) vs. dynamic access možný (medium).
- **Escalation:** Žádná.

### 4.6 `architect.md` — opus

- **Description:** "Design decisions, cross-cutting concerns, architecture trade-offs. Use when constraints conflict or pattern choice is non-obvious."
- **Tools:** `Read, Grep, Glob, WebFetch`
- **Role:** Compare options, recommend with reasoning, write ADR-style output.
- **Output:** Markdown s sekcemi `Options / Trade-offs / Recommendation / Why / Risks`.
- **Escalation:** `NEEDS_CONTEXT` pokud neví business constraints.

## 5. Update `detect-triggers.js`

Soubor: `~/.claude/hooks/detect-triggers.js`, řádky 51-62 (`tokenMatch` sekce).

**Změna:** Routing tabulka v reminder textu nahrazená konkrétními agent names:

```diff
2. **Routing tabulka** (CLAUDE.md: Subagent budget):
-   - implementer (mechanický, 1–2 soubory) → haiku
-   - implementer (multi-file, integrace) → sonnet
-   - spec reviewer → haiku
-   - code/final reviewer → sonnet (rozsáhlé → opus)
+   - `implementer-mech` (haiku) — 1-2 file mechanical change
+   - `implementer-multi` (sonnet) — multi-file / integration
+   - `spec-reviewer` (haiku) — spec ↔ code check
+   - `code-reviewer` (sonnet) — quality, smells, bugs
+   - `dead-code-scanner` (haiku) — unused exports/imports
+   - `architect` (opus) — design decisions, ADR
+
+   Each agent has its definition in `~/.claude/agents/<name>.md`.
```

Žádné jiné změny v souboru.

## 6. Update `token-aware` skill

Soubor: `~/.claude/skills/token-aware/SKILL.md`.

**Změna:** Sekce s routing pravidly resynchronizovaná s detect-triggers.js. Plus
poznámka "Use these by name in Agent tool calls — `subagent_type: \"<name>\"`."

Přesný rozsah úpravy bude součástí implementation plan (writing-plans skill
spočítá řádky), tady stačí směr.

## 7. Verifikace po implementaci

1. **Existence:** `Glob ~/.claude/agents/*.md` → 6 souborů.
2. **Frontmatter validace:** každý soubor má `name`, `description`, `model`,
   `tools`. (Manual review.)
3. **Test dispatch:** spawnu `implementer-mech` na drobný úkol (typo fix v
   nějakém testovacím repu). Ověřím:
   - `cache/agents-running.json` zaznamenal agent_type = `implementer-mech`
   - `logs/agent-durations.jsonl` má nový záznam s model = haiku
   - Agent skutečně dokončil úkol bez `BLOCKED`.
4. **Regression:** `node scripts/agent-stats.test.js` musí projít beze změny.
5. **Hook syntax check:** `node hooks/detect-triggers.js < test-input.json`
   nemá syntax chybu, vrací validní JSON.

## 8. Rollback

Vše additive + 2 reverzibilní diffy:

- `rm ~/.claude/agents/*.md` — odstraní soubory.
- `git revert <commit>` na detect-triggers.js a token-aware/SKILL.md.

Žádný state, žádná migrace. Existující dispatch flow funguje bez nových agentů
(orchestrator může nadále explicit-model parametr).

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Subagent description není dost specifická → orchestrator se splete | Stress-test v step 7 verifikace; refinement v iteraci 2. |
| `CLAUDE_CODE_SUBAGENT_MODEL` env var by overrideoval frontmatter | Zkontroluju že není v `~/.claude/settings.json` ani v shell profile. Pokud je, dokumentuji to v CLAUDE.md jako konflikt. |
| Anthropic změní resolver order v budoucí verzi | Reálně low-risk — order je stable od v2.0.x. Sledujeme changelog. |
| Naming collision se built-in agenty (`general-purpose`, `Explore`, `Plan`) | Naše názvy jsou unikátní, žádný overlap. |
| Token saving se nepotvrdí | Měříme přes `duration-stats.json` cost cache. Po 1-2 týdnech porovnám pre/post baseline. |

## 10. Success kritéria

- 6 agentů existuje a invokovatelných přes Agent tool call (`subagent_type: "<name>"`).
- `detect-triggers.js` reminder odkazuje konkrétní jména.
- `token-aware` SKILL.md odkazuje konkrétní jména.
- Pre/post 2-week measurement: aspoň 15% pokles průměrné ceny per Agent dispatch (z `cost-cache.json`).
- Žádná regrese v `agent-stats.test.js`.

---

## Implementation plan

Bude vytvořen samostatně skillem `writing-plans` po schválení tohoto specu.
