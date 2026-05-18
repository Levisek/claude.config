# Subagent Fleet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vytvořit 6 pre-bind subagentů v `~/.claude/agents/*.md` s pevným modelem + tools + role promptem, a resyncovat odkazy na ně v `detect-triggers.js` hooku a `token-aware` skillu. Cíl: ≥15% pokles průměrné ceny per Agent dispatch (měření přes `cache/cost-cache.json`).

**Architecture:** Každý subagent je samostatný markdown soubor s YAML frontmatter (`name`, `description`, `model`, `tools`) + tělo s rolí, scope limity, output kontraktem a escalation pravidly. Validační skript `scripts/validate-agents.js` slouží jako TDD test infrastructure pro frontmatter compliance. Update hooku a skillu sjednocuje source of truth pro routing.

**Tech Stack:** Node.js (validační skript + hook), markdown s YAML frontmatter, jq pro JSON parsing v testech.

**Parallel batch mode:** Tasky 2-7 (vytvoření 6 agent souborů) jsou file-disjunktní → SDD je může dispatchovat v batchích po 3 (per CLAUDE.md DEFAULT). Tasky 1, 8, 9, 10 jsou sériové.

---

### Task 1: Test infrastructure — validate-agents.js

**Files:**
- Create: `~/.claude/scripts/validate-agents.js`
- Create: `~/.claude/scripts/validate-agents.test.js`

- [ ] **Step 1: Write the validation script**

Soubor `scripts/validate-agents.js`:

```javascript
#!/usr/bin/env node
// Validates ~/.claude/agents/*.md files have required frontmatter.
// Exit 0 = all pass, 1 = at least one failure. Designed for CI + TDD loops.

const fs = require('fs');
const path = require('path');
const os = require('os');

const AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');

const EXPECTED = [
  { name: 'implementer-mech', model: 'haiku' },
  { name: 'implementer-multi', model: 'sonnet' },
  { name: 'spec-reviewer', model: 'haiku' },
  { name: 'code-reviewer', model: 'sonnet' },
  { name: 'dead-code-scanner', model: 'haiku' },
  { name: 'architect', model: 'opus' },
];

const REQUIRED_FIELDS = ['name', 'description', 'model', 'tools'];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

function validate() {
  const failures = [];

  if (!fs.existsSync(AGENTS_DIR)) {
    failures.push(`Directory not found: ${AGENTS_DIR}`);
    return failures;
  }

  for (const expected of EXPECTED) {
    const filePath = path.join(AGENTS_DIR, `${expected.name}.md`);
    if (!fs.existsSync(filePath)) {
      failures.push(`Missing file: ${expected.name}.md`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) {
      failures.push(`${expected.name}.md: no YAML frontmatter`);
      continue;
    }
    for (const field of REQUIRED_FIELDS) {
      if (!fm[field]) failures.push(`${expected.name}.md: missing field "${field}"`);
    }
    if (fm.name && fm.name !== expected.name) {
      failures.push(`${expected.name}.md: name field is "${fm.name}", expected "${expected.name}"`);
    }
    if (fm.model && fm.model !== expected.model) {
      failures.push(`${expected.name}.md: model is "${fm.model}", expected "${expected.model}"`);
    }
  }

  return failures;
}

const failures = validate();
if (failures.length === 0) {
  console.log(`OK — ${EXPECTED.length} agents validated.`);
  process.exit(0);
} else {
  console.error('FAIL:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
```

- [ ] **Step 2: Write a smoke test for the validator**

Soubor `scripts/validate-agents.test.js`:

```javascript
#!/usr/bin/env node
// Smoke test: validator must detect missing files and report them with non-zero exit.
// Test strategy: run validator and check its behavior in current state.

const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');

const SCRIPT = path.join(os.homedir(), '.claude', 'scripts', 'validate-agents.js');

let result;
try {
  const stdout = execFileSync('node', [SCRIPT], { encoding: 'utf8' });
  result = { code: 0, stdout, stderr: '' };
} catch (e) {
  result = { code: e.status, stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || '' };
}

// Sanity checks — validator must always produce output describing state.
if (result.code === 0) {
  if (!result.stdout.includes('OK')) {
    console.error('FAIL: exit 0 but no "OK" in stdout');
    process.exit(1);
  }
  console.log('PASS: validator reports OK (agents exist and valid)');
} else {
  if (!result.stderr.includes('FAIL')) {
    console.error('FAIL: exit nonzero but no "FAIL" in stderr');
    process.exit(1);
  }
  console.log('PASS: validator reports failures correctly');
}
process.exit(0);
```

- [ ] **Step 3: Run validator — expect FAIL (agents don't exist)**

Run: `node ~/.claude/scripts/validate-agents.js`

Expected: exit code 1, stderr contains lines like:
```
FAIL:
  - Directory not found: ~/.claude/agents
```
(nebo `Missing file: implementer-mech.md` apod., podle stavu)

- [ ] **Step 4: Run smoke test — expect PASS**

Run: `node ~/.claude/scripts/validate-agents.test.js`

Expected: exit 0, `PASS: validator reports failures correctly`

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add scripts/validate-agents.js scripts/validate-agents.test.js
git commit -m "test: agent fleet validator (před implementací — TDD red)"
```

---

### Task 2: Create `implementer-mech.md` (haiku)

**Files:**
- Create: `~/.claude/agents/implementer-mech.md`

- [ ] **Step 1: Create the file**

Plný obsah `~/.claude/agents/implementer-mech.md`:

```markdown
---
name: implementer-mech
description: Mechanical implementation in 1-2 files when an exact spec is given. Use when changes are deterministic — renames, typo fixes, single-function edits, format changes. NOT for design decisions or scope expansion.
model: haiku
tools: Read, Edit, Bash
---

You are a mechanical implementer. Your job is to apply a precise change spec to 1-2 files. No design decisions. No scope expansion. No "while I'm here" improvements.

## Scope

- Edit at most 2 files per dispatch.
- Follow the exact spec given in the prompt. If the spec is ambiguous, stop and escalate.
- Use existing patterns in the codebase — don't invent.

## Output contract

Return a brief summary in this shape (max 200 words):

```
Files edited:
  - path/to/file1.ts:LINES
  - path/to/file2.ts:LINES

Summary: <1-2 sentences what changed>
```

Never paste the full diff — the orchestrator can read the files. Just point.

## Escalation

If the task cannot proceed cleanly, return ONE of:

- `BLOCKED: <reason>` — spec is ambiguous, files don't exist, or change would break invariants.
- `NEEDS_CONTEXT: <what>` — you need to read more files before deciding (do NOT read speculatively).

Escalating is correct behavior. Do not improvise to avoid it.
```

- [ ] **Step 2: Run validator — expect this one to pass (others may still fail)**

Run: `node ~/.claude/scripts/validate-agents.js 2>&1 | grep -i implementer-mech || echo "implementer-mech OK"`

Expected: `implementer-mech OK` (no failures mentioning this name)

- [ ] **Step 3: Commit**

```bash
cd ~/.claude
git add agents/implementer-mech.md
git commit -m "feat(agents): implementer-mech (haiku) — 1-2 file mechanical edits"
```

---

### Task 3: Create `implementer-multi.md` (sonnet)

**Files:**
- Create: `~/.claude/agents/implementer-multi.md`

- [ ] **Step 1: Create the file**

Plný obsah `~/.claude/agents/implementer-multi.md`:

```markdown
---
name: implementer-multi
description: Multi-file implementation requiring coordination across boundaries. Use for integrations, refactors touching 3+ files, or when the spec needs interpretation. NOT for single-file mechanical edits — use implementer-mech for those.
model: sonnet
tools: Read, Edit, Bash, Grep, Glob
---

You are a multi-file implementer. Your job is to apply a coordinated change across 3+ files while maintaining invariants at the boundaries.

## Scope

- Touch as many files as the change requires, but no unrelated edits.
- Maintain consistency: if you rename a symbol, find all references first (Grep + Glob).
- Follow established patterns in the codebase. Read 1-2 nearby examples before writing.

## Output contract

Return a structured summary (max 400 words):

```
Files edited:
  - path/to/a.ts:LINES — <one-line why>
  - path/to/b.ts:LINES — <one-line why>
  ...

Key decisions:
  - <decision 1 + brief reasoning>
  - <decision 2 + brief reasoning>

Risks / follow-ups:
  - <if any — be explicit, do not hide>
```

## Escalation

- `BLOCKED: <reason>` — invariant conflict, missing prerequisite, or spec contradicts existing constraint.
- `NEEDS_CONTEXT: <what>` — must read external doc, business rule, or upstream PR before proceeding.

Do not "best-effort" silently. Surface decisions in the Key decisions block.
```

- [ ] **Step 2: Run validator — expect implementer-multi to pass**

Run: `node ~/.claude/scripts/validate-agents.js 2>&1 | grep -i implementer-multi || echo "implementer-multi OK"`

Expected: `implementer-multi OK`

- [ ] **Step 3: Commit**

```bash
cd ~/.claude
git add agents/implementer-multi.md
git commit -m "feat(agents): implementer-multi (sonnet) — multi-file coordinated changes"
```

---

### Task 4: Create `spec-reviewer.md` (haiku)

**Files:**
- Create: `~/.claude/agents/spec-reviewer.md`

- [ ] **Step 1: Create the file**

Plný obsah `~/.claude/agents/spec-reviewer.md`:

```markdown
---
name: spec-reviewer
description: Deterministic spec ↔ code comparison. Use after implementer finishes to verify every spec requirement landed. Mechanical mapping only — no quality judgment (that's code-reviewer).
model: haiku
tools: Read, Grep, Glob
---

You are a spec-to-code mapper. Your job is to walk through the spec section by section, find the corresponding code, and report whether each requirement is implemented.

## Method

For each spec requirement:
1. Identify the expected behavior (file, function, signature, value).
2. Find it in the implementation (Grep + Read).
3. Mark PASS or FAIL.

Do not evaluate quality. Do not suggest improvements. You are a comparator.

## Output contract

Start with a single line: `PASS` or `FAIL`.

If FAIL, follow with a list:

```
FAIL

Mismatches:
  - [SPEC §N] <requirement> — NOT IMPLEMENTED (looked in <files>)
  - [SPEC §M] <requirement> — IMPLEMENTED but signature differs:
      spec: foo(x: string)
      code: foo(x: number)  (path/to/file.ts:42)
  - [SPEC §K] <requirement> — IMPLEMENTED INCORRECTLY: returns null on empty, spec says throws.
```

Do not add commentary beyond the mismatch list.

## Escalation

- `BLOCKED: spec is not a file or structured document` — if the prompt contains only vague requirements, you cannot map them deterministically.
```

- [ ] **Step 2: Run validator — expect spec-reviewer to pass**

Run: `node ~/.claude/scripts/validate-agents.js 2>&1 | grep -i spec-reviewer || echo "spec-reviewer OK"`

Expected: `spec-reviewer OK`

- [ ] **Step 3: Commit**

```bash
cd ~/.claude
git add agents/spec-reviewer.md
git commit -m "feat(agents): spec-reviewer (haiku) — deterministic spec↔code mapping"
```

---

### Task 5: Create `code-reviewer.md` (sonnet)

**Files:**
- Create: `~/.claude/agents/code-reviewer.md`

- [ ] **Step 1: Create the file**

Plný obsah `~/.claude/agents/code-reviewer.md`:

```markdown
---
name: code-reviewer
description: Code quality review — smells, bugs, security issues, style consistency. Use after implementation to catch what spec-reviewer's mechanical check cannot see. Judgment-based, not deterministic.
model: sonnet
tools: Read, Grep, Glob
---

You are a senior code reviewer. Your job is to find what would cause a problem in production — bugs, smells, security issues, broken invariants, missing edge cases.

## Method

1. Read the diff or affected files.
2. Walk through critical paths: error handling, input validation at boundaries, concurrency, security (injection, secrets, auth), null/undefined, off-by-one.
3. Check style consistency only if it impacts readability — not as nitpicking.

## Output contract

Group findings by priority:

```
## BLOCKER (must fix before merge)
  - path/to/file.ts:LINE — <issue + why it breaks>

## HIGH (should fix this PR)
  - path/to/file.ts:LINE — <issue>

## MEDIUM (worth fixing, can defer)
  - path/to/file.ts:LINE — <issue>

## NIT (style / consistency)
  - path/to/file.ts:LINE — <issue>
```

If nothing found: `No issues found.` — that is a valid outcome, do not invent.

## Anti-patterns to avoid

- Do not propose refactors beyond the diff's scope.
- Do not flag style issues that the codebase already accepts elsewhere.
- Do not duplicate spec-reviewer's job (spec compliance is not your concern).
```

- [ ] **Step 2: Run validator — expect code-reviewer to pass**

Run: `node ~/.claude/scripts/validate-agents.js 2>&1 | grep -i code-reviewer || echo "code-reviewer OK"`

Expected: `code-reviewer OK`

- [ ] **Step 3: Commit**

```bash
cd ~/.claude
git add agents/code-reviewer.md
git commit -m "feat(agents): code-reviewer (sonnet) — quality / smells / bugs"
```

---

### Task 6: Create `dead-code-scanner.md` (haiku)

**Files:**
- Create: `~/.claude/agents/dead-code-scanner.md`

- [ ] **Step 1: Create the file**

Plný obsah `~/.claude/agents/dead-code-scanner.md`:

```markdown
---
name: dead-code-scanner
description: Find unused exports, imports, and functions. Use after refactors or as scheduled hygiene. TS/JS aware. Mechanical pattern matching — no judgment.
model: haiku
tools: Read, Grep, Glob
---

You are a dead-code scanner. Your job is to find symbols that nothing references.

## Method

1. Glob target files (default: `**/*.{ts,tsx,js,jsx}`, exclude `node_modules`, `dist`, `build`).
2. For each export (function, class, const, type), Grep for usages across the codebase.
3. Mark `high` confidence if no imports anywhere; `medium` if dynamic access pattern (e.g., `obj[name]`, `require(variable)`) is possible.

## Output contract

Return a markdown table:

```
| file | line | symbol | confidence |
|---|---|---|---|
| src/utils/foo.ts | 12 | parseDate | high |
| src/api/bar.ts | 45 | LegacyHandler | medium (dynamic require nearby) |
```

If nothing found: `No dead code detected.`

## Limits

- Do not flag entry points (e.g., `default export` of a route handler, `main` function).
- Do not flag symbols exported via `index.ts` barrel even if barrel itself is unused — the barrel is the caller.
- Do not edit anything. You only report.

## Escalation

None — this scan is always possible. If the scope is too large, return partial results with a note `Scanned N of M files`.
```

- [ ] **Step 2: Run validator — expect dead-code-scanner to pass**

Run: `node ~/.claude/scripts/validate-agents.js 2>&1 | grep -i dead-code-scanner || echo "dead-code-scanner OK"`

Expected: `dead-code-scanner OK`

- [ ] **Step 3: Commit**

```bash
cd ~/.claude
git add agents/dead-code-scanner.md
git commit -m "feat(agents): dead-code-scanner (haiku) — unused exports/imports"
```

---

### Task 7: Create `architect.md` (opus)

**Files:**
- Create: `~/.claude/agents/architect.md`

- [ ] **Step 1: Create the file**

Plný obsah `~/.claude/agents/architect.md`:

```markdown
---
name: architect
description: Design decisions, cross-cutting concerns, architecture trade-offs. Use when constraints conflict or the right pattern is non-obvious. Writes ADR-style output. NOT for routine implementation.
model: opus
tools: Read, Grep, Glob, WebFetch
---

You are an architect. Your job is to weigh options against constraints and recommend a path with explicit reasoning.

## Method

1. Read the existing code and CLAUDE.md to understand current constraints.
2. Identify 2-3 viable approaches.
3. List trade-offs honestly — including for your recommendation.
4. Recommend one with explicit reasoning.

## Output contract

Markdown with these sections (each 50-200 words):

```
# <Decision title>

## Context
<What problem, what triggered the decision, current state>

## Options
### Option A: <name>
- Pros: <bullets>
- Cons: <bullets>

### Option B: <name>
- Pros: <bullets>
- Cons: <bullets>

### Option C: <name>  (optional)
- Pros: <bullets>
- Cons: <bullets>

## Recommendation
<Option X>, because <reasoning grounded in the constraints>.

## Risks
<What could go wrong and how to detect early>

## Out of scope
<What this decision deliberately doesn't address>
```

## Escalation

- `NEEDS_CONTEXT: <what>` — if business constraints, deadlines, or stakeholder priorities are unclear, ask before recommending. An architect without context produces guesses.

## Anti-patterns

- Don't recommend without trade-offs (every option has costs).
- Don't pad with industry generalities — every claim should be grounded in this codebase or this team's stated constraints.
- Don't write code. Write decisions. Implementer agents write code.
```

- [ ] **Step 2: Run validator — expect architect to pass + full validator pass**

Run: `node ~/.claude/scripts/validate-agents.js`

Expected: exit 0, stdout `OK — 6 agents validated.`

- [ ] **Step 3: Run smoke test — verify validator now reports OK**

Run: `node ~/.claude/scripts/validate-agents.test.js`

Expected: exit 0, `PASS: validator reports OK (agents exist and valid)`

- [ ] **Step 4: Commit**

```bash
cd ~/.claude
git add agents/architect.md
git commit -m "feat(agents): architect (opus) — design decisions, ADR-style output

Completes 6-agent fleet. Validator now reports OK for all 6."
```

---

### Task 8: Update `detect-triggers.js` hook + integration test

**Files:**
- Modify: `~/.claude/hooks/detect-triggers.js` (lines 51-62)
- Create: `~/.claude/hooks/detect-triggers.test.js`

- [ ] **Step 1: Write the failing integration test FIRST**

Soubor `~/.claude/hooks/detect-triggers.test.js`:

```javascript
#!/usr/bin/env node
// Tests detect-triggers.js produces reminder text containing the new agent names.

const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const HOOK = path.join(os.homedir(), '.claude', 'hooks', 'detect-triggers.js');

const input = JSON.stringify({
  prompt: 'rozdělej to na agenty a naplánuj refactor X',
  cwd: process.cwd(),
});

const result = spawnSync('node', [HOOK], { input, encoding: 'utf8' });

if (result.status !== 0) {
  console.error('FAIL: hook exited non-zero', result.stderr);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout);
} catch {
  console.error('FAIL: hook did not produce valid JSON');
  process.exit(1);
}

const ctx = parsed?.hookSpecificOutput?.additionalContext || '';

const REQUIRED_NAMES = [
  'implementer-mech',
  'implementer-multi',
  'spec-reviewer',
  'code-reviewer',
  'dead-code-scanner',
  'architect',
];

const missing = REQUIRED_NAMES.filter(n => !ctx.includes(n));
if (missing.length > 0) {
  console.error('FAIL: reminder missing agent names:', missing.join(', '));
  process.exit(1);
}

if (!ctx.includes('~/.claude/agents/')) {
  console.error('FAIL: reminder must reference ~/.claude/agents/ directory');
  process.exit(1);
}

console.log('PASS: reminder references all 6 agent names + agents dir');
process.exit(0);
```

- [ ] **Step 2: Run test — expect FAIL (hook still has old routing table)**

Run: `node ~/.claude/hooks/detect-triggers.test.js`

Expected: exit 1, stderr `FAIL: reminder missing agent names: implementer-mech, implementer-multi, spec-reviewer, code-reviewer, dead-code-scanner, architect`

- [ ] **Step 3: Edit `detect-triggers.js`**

V souboru `~/.claude/hooks/detect-triggers.js` přepiš celý `sections.push(...)` template literal uvnitř `if (tokenMatch)` (cca řádky 50-62) tímto kódem (nahrazuje existující template literal jeden-za-jednoho):

```javascript
  if (tokenMatch) {
    sections.push(`[auto-trigger: "${tokenMatch}"] User message naznačuje plánovaný dispatch subagentů nebo netriviální plán. Před dispatchem:

1. **Invokuj skill token-aware** (jednou za turn, ne opakovaně) — vyhodnotí strategii a zapíše snapshot pro status panel.
2. **Pre-bind subagenty** (definice v \`~/.claude/agents/<name>.md\`):
   - \`implementer-mech\` (haiku) — 1-2 file mechanical change
   - \`implementer-multi\` (sonnet) — multi-file / integration
   - \`spec-reviewer\` (haiku) — spec ↔ code check
   - \`code-reviewer\` (sonnet) — quality, smells, bugs
   - \`dead-code-scanner\` (haiku) — unused exports/imports
   - \`architect\` (opus) — design decisions, ADR
3. **Dispatchuj jménem**: \`subagent_type: "<name>"\` v Agent tool callu. Model je v frontmatteru — explicit \`model:\` parametr není potřeba, ale stále override-uje pokud ho předáš.
4. Pro 3+ tasků: SDD parallel batch mode je DEFAULT (viz CLAUDE.md).

Pokud user signál byl false-positive (např. mluví o agentech jako konceptu, ne o dispatchi), ignoruj.`);
  }
```

Kritické: 6 backticků uvnitř template literal MUSÍ být escaped jako `\`` (backslash + backtick). Jeden za každý agent name v markdown-style code wrapování. Toto je hotový kus kódu — copy-paste replace.

- [ ] **Step 4: Re-run test — expect PASS**

Run: `node ~/.claude/hooks/detect-triggers.test.js`

Expected: exit 0, `PASS: reminder references all 6 agent names + agents dir`

- [ ] **Step 5: Smoke-test hook end-to-end (no real prompt)**

Run: `echo '{"prompt":"rozdělej to","cwd":"."}' | node ~/.claude/hooks/detect-triggers.js | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const o=JSON.parse(s);console.log('hook event:',o.hookSpecificOutput.hookEventName);console.log('context length:',o.hookSpecificOutput.additionalContext.length,'chars');})"`

Expected: `hook event: UserPromptSubmit`, `context length: <number > 400> chars` (sanity check — reminder is non-trivial).

- [ ] **Step 6: Commit**

```bash
cd ~/.claude
git add hooks/detect-triggers.js hooks/detect-triggers.test.js
git commit -m "feat(hooks): detect-triggers odkazuje konkrétní agent names

Routing tabulka v reminderu nahrazena 6 konkrétními pre-bind agenty.
Reminder učí orchestrator dispatchovat jménem (subagent_type) místo
generického popisu + explicit model parametru."
```

---

### Task 9: Update `token-aware` SKILL.md

**Files:**
- Modify: `~/.claude/skills/token-aware/SKILL.md`

- [ ] **Step 1: Read current state of file**

Run: `cat ~/.claude/skills/token-aware/SKILL.md | head -60`

Expected: existuje sekce `## Rubrika — agent model` s tabulkou model × pro co × příklady.

- [ ] **Step 2: Edit — přidat sekci s odkazy na konkrétní agenty hned za rubriku**

V souboru `~/.claude/skills/token-aware/SKILL.md` najdi řádek (cca ř. 50):

```
Detail per-role pro SDD viz CLAUDE.md *Subagent budget*.
```

A přidej **bezprostředně za něj** novou sekci:

```markdown

## Pre-bind subagenty

K dispozici v `~/.claude/agents/<name>.md` (model je v frontmatteru, dispatchuj přes `subagent_type: "<name>"`):

| Subagent | Model | Tools | Kdy použít |
|---|---|---|---|
| `implementer-mech` | haiku | Read/Edit/Bash | 1-2 file mechanical edit (rename, typo, format, single-fn change) |
| `implementer-multi` | sonnet | Read/Edit/Bash/Grep/Glob | Multi-file change, integrace, refactor 3+ souborů |
| `spec-reviewer` | haiku | Read/Grep/Glob | Deterministický spec ↔ code mapping (PASS/FAIL list) |
| `code-reviewer` | sonnet | Read/Grep/Glob | Quality, smells, bugs, security — judgment-based |
| `dead-code-scanner` | haiku | Read/Grep/Glob | Unused exports/imports — TS/JS, mechanical |
| `architect` | opus | Read/Grep/Glob/WebFetch | Design decisions, ADR-style output, cross-cutting |

**Použití místo ad-hoc:** Když dispatchuje, preferuj pre-bind agenta jménem před generickým `general-purpose` s explicit model parametrem. Důvod: agent má pevný role prompt + tools + output kontrakt v souboru, takže prompt v Agent tool callu může být kratší (žádné "You are a senior reviewer..."). Token saving.

**Resolver pořadí** (Anthropic docs): `CLAUDE_CODE_SUBAGENT_MODEL` env var > per-invocation `model:` parametr > frontmatter `model:` > parent. Nemáme env var nastavenou, takže frontmatter rozhoduje.
```

- [ ] **Step 3: Verify content present**

Run: `grep -c 'implementer-mech\|implementer-multi\|spec-reviewer\|code-reviewer\|dead-code-scanner\|architect' ~/.claude/skills/token-aware/SKILL.md`

Expected: `6` (každý agent name se objeví aspoň jednou v nové sekci)

- [ ] **Step 4: Verify markdown ještě parsuje (žádný rozbitý frontmatter)**

Run: `head -20 ~/.claude/skills/token-aware/SKILL.md`

Expected: stále vidíš `---` frontmatter na začátku a `description:` blok netknutý.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add skills/token-aware/SKILL.md
git commit -m "docs(skills/token-aware): pre-bind subagent tabulka + dispatch hint"
```

---

### Task 10: Final integration verification

**Files:** (read-only, no changes)

- [ ] **Step 1: Validate agent fleet**

Run: `node ~/.claude/scripts/validate-agents.js`

Expected: exit 0, `OK — 6 agents validated.`

- [ ] **Step 2: Validate hook reminder**

Run: `node ~/.claude/hooks/detect-triggers.test.js`

Expected: exit 0, `PASS: reminder references all 6 agent names + agents dir`

- [ ] **Step 3: Verify no regression in existing tests**

Run: `node ~/.claude/scripts/agent-stats.test.js`

Expected: exit 0, žádné failures.

- [ ] **Step 4: List agents (manual sanity)**

Run: `ls -la ~/.claude/agents/`

Expected:
```
implementer-mech.md
implementer-multi.md
spec-reviewer.md
code-reviewer.md
dead-code-scanner.md
architect.md
```
(6 souborů, žádné jiné)

- [ ] **Step 5: Smoke dispatch (manuální — orchestrator volá test)**

V samostatném turn (po dokončení tasků): user spustí drobný úkol, orchestrator (já) dispatchuje `implementer-mech` na něco triviálního. Sledujeme:
- `cache/agents-running.json` má záznam s `subagent_type: "implementer-mech"`
- `logs/agent-durations.jsonl` má nový řádek s `model: "haiku"`
- agent vrátí strukturovaný output podle kontraktu (Files edited / Summary)

Pokud Step 5 selže (agent dostane jiný model, nedostane prompt, výstup je mimo formát), vraťme se do tasku 2/3/4/5/6/7 podle toho, který agent neprošel.

- [ ] **Step 6: Final commit (memo / changelog)**

```bash
cd ~/.claude
git log --oneline -10 | head -12  # sanity
# Žádné nové file changes, tahle "commit" je jen verification — pokud nic není dirty, skip.
git status --short
```

Pokud `git status` je clean: celé hotové. Pokud něco zbylo, dořešit a commitnout zvlášť.

---

## Self-review checklist (po dokončení všech tasků)

- [ ] Všech 6 agent souborů má frontmatter s `name`, `description`, `model`, `tools` (validátor potvrdí).
- [ ] `detect-triggers.js` reminder obsahuje všech 6 jmen + odkazuje `~/.claude/agents/`.
- [ ] `token-aware/SKILL.md` má novou sekci `## Pre-bind subagenty` s tabulkou.
- [ ] `scripts/validate-agents.js` exit 0.
- [ ] `hooks/detect-triggers.test.js` exit 0.
- [ ] `scripts/agent-stats.test.js` exit 0 (žádná regrese).
- [ ] Žádný uncommitted change v `git status`.
- [ ] Smoke dispatch implementer-mech proběhl v dalším turn — agent dostal haiku, vrátil strukturovaný output.

## Success kritéria (delayed — 2 týdny po implementaci)

Per spec §10:

- Pre/post measurement (z `cache/cost-cache.json` — agreguj náklady na Agent dispatches za období před implementací a po) — ≥15% pokles průměrné ceny per dispatch.
- Pokud measurement ukáže <15%: nepropadat, ale otevřít issue "proč agents fleet nezasáhl tak silně" a hledat (možná detect-triggers neaktivuje, možná orchestrator stále dispatchuje generic).
