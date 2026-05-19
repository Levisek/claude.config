# Activation & Dietetics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 3 wins které sníží per-session token overhead: `claudeMdExcludes` pro vendored CLAUDE.md, source-aware SessionStart banner diet, konzervativní skill hints v UserPromptSubmit hooku.

**Architecture:** Vše additive změny v existujících konfigurech a hooks. Win 1 = 1 pole v `settings.json`. Win 2 = source-based větvení v `session-context.js` + nový hook test. Win 3 = nová `skillHints` sekce v `detect-triggers.js` + rozšířený existující test. TDD red→green pro Win 2 a Win 3.

**Tech Stack:** Node.js (hooks + testy spawnSync), JSON (settings). Žádné nové dependencies.

**Sériový ordering:** Win 1 → Win 2 (test → impl) → Win 3 (test → impl) → integration. Parallel batching nepřináší významnou úsporu — každý Win je 1-2 commits, dependencies jsou triviální.

---

### Task 1: Win 1 — `claudeMdExcludes` v settings.json

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Read current state and find insertion point**

Run: `cat ~/.claude/settings.json | grep -n '"statusLine"\|"enabledPlugins"\|"hooks"'`

Expected output (line numbers, key names — confirms which fields exist + their order).

- [ ] **Step 2: Edit settings.json — add `claudeMdExcludes` field**

V `~/.claude/settings.json`, najdi closing brace `}` na konci `hooks` objektu (cca řádek 109). Hned ZA ním (před `statusLine`) přidej nové pole. Použij Edit tool:

**old_string:**
```
  },
  "statusLine": {
```

**new_string:**
```
  },
  "claudeMdExcludes": [
    "**/node_modules/**/CLAUDE.md",
    "**/.claude/plugins/cache/**/CLAUDE.md",
    "**/.claude/skills/trailofbits/CLAUDE.md"
  ],
  "statusLine": {
```

Indentace: 2 spaces (match existing file style).

- [ ] **Step 3: Verify JSON parses**

Run: `node -e "const c=require('fs').readFileSync('/c/Users/admin/.claude/settings.json','utf8');const p=JSON.parse(c);console.log('OK, claudeMdExcludes length:',p.claudeMdExcludes?.length)"`

Expected stdout: `OK, claudeMdExcludes length: 3`

- [ ] **Step 4: Verify other fields untouched**

Run: `node -e "const p=JSON.parse(require('fs').readFileSync('/c/Users/admin/.claude/settings.json','utf8'));console.log('hooks:',Object.keys(p.hooks).length,'permissions deny:',p.permissions.deny.length,'statusLine type:',p.statusLine.type)"`

Expected stdout: `hooks: 4 permissions deny: 26 statusLine type: command`

(4 hook events: PreToolUse, PostToolUse, SessionStart, UserPromptSubmit; 26 deny rules; statusLine.type "command")

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add settings.json
git commit -m "feat(settings): claudeMdExcludes pro vendored CLAUDE.md soubory

Skipne 3 vzory: node_modules, plugins/cache/**, skills/trailofbits.
Šetří per-session tokens při exploration vyloučených subtrees."
```

---

### Task 2: Win 2 RED — session-context.test.js (failing test before impl)

**Files:**
- Create: `~/.claude/hooks/session-context.test.js`

- [ ] **Step 1: Write the test file**

Vytvoř `~/.claude/hooks/session-context.test.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// Tests session-context.js produces source-aware output:
// - startup: full banner + sparkline + tip
// - resume:  no banner, no sparkline, no tip (slim)
// - clear:   no banner, no sparkline, no tip (slim)
// - compact: no banner + tip, but sparkline retained (Claude needs orientation)

const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const HOOK = path.join(os.homedir(), '.claude', 'hooks', 'session-context.js');
const CWD = path.join(os.homedir(), '.claude'); // git repo with commits

function runHook(source) {
  const input = JSON.stringify({ source, cwd: CWD });
  const result = spawnSync('node', [HOOK], { input, encoding: 'utf8' });
  if (result.status !== 0) {
    return { error: `non-zero exit (${result.status}): ${result.stderr}` };
  }
  let parsed;
  try { parsed = JSON.parse(result.stdout); }
  catch { return { error: `invalid JSON: ${result.stdout.slice(0,200)}` }; }
  return { ctx: parsed?.hookSpecificOutput?.additionalContext || '' };
}

// Anchor strings:
//   'napiš /welcome' = welcome tip (unique substring)
//   'posledních '    = sparkline label "posledních N commitů ..."
const TIP_ANCHOR = 'napiš /welcome';
const SPARK_ANCHOR = 'posledních ';

const cases = [
  { source: 'startup', mustContain: [TIP_ANCHOR, SPARK_ANCHOR], mustNotContain: [] },
  { source: 'resume',  mustContain: [],                          mustNotContain: [TIP_ANCHOR, SPARK_ANCHOR] },
  { source: 'clear',   mustContain: [],                          mustNotContain: [TIP_ANCHOR, SPARK_ANCHOR] },
  { source: 'compact', mustContain: [SPARK_ANCHOR],              mustNotContain: [TIP_ANCHOR] },
];

let failed = 0;
for (const c of cases) {
  const r = runHook(c.source);
  if (r.error) {
    console.error(`FAIL [source=${c.source}]: ${r.error}`);
    failed++;
    continue;
  }
  const issues = [];
  for (const m of c.mustContain) {
    if (!r.ctx.includes(m)) issues.push(`missing "${m}"`);
  }
  for (const m of c.mustNotContain) {
    if (r.ctx.includes(m)) issues.push(`should NOT contain "${m}"`);
  }
  if (issues.length > 0) {
    console.error(`FAIL [source=${c.source}]: ${issues.join('; ')}`);
    failed++;
  } else {
    console.log(`PASS [source=${c.source}]`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} source cases pass`);
process.exit(0);
```

- [ ] **Step 2: Run test — expect FAIL (current hook ignores source)**

Run: `node ~/.claude/hooks/session-context.test.js`

Expected: exit 1, output includes:
```
PASS [source=startup]
FAIL [source=resume]: should NOT contain "napiš /welcome"; should NOT contain "posledních "
FAIL [source=clear]: should NOT contain "napiš /welcome"; should NOT contain "posledních "
FAIL [source=compact]: should NOT contain "napiš /welcome"

3 of 4 cases failed
```

(Aktuální session-context.js renderuje tip a sparkline bez ohledu na source — proto resume/clear/compact failnou. Startup passne protože tip+sparkline pořád být mají.)

- [ ] **Step 3: Commit test (TDD red)**

```bash
cd ~/.claude
git add hooks/session-context.test.js
git commit -m "test(session-context): source-aware větvení (TDD red před Win 2 impl)"
```

---

### Task 3: Win 2 GREEN — session-context.js source branching

**Files:**
- Modify: `~/.claude/hooks/session-context.js`

- [ ] **Step 1: Read current state to confirm structure**

Run: `cat ~/.claude/hooks/session-context.js | head -100`

Expected: file je ~100 řádků, používá `theme.loadConfig()`, `theme.glyphs()`, renderuje banner conditional on `source === 'startup'`, pak git panel + sparkline + tip.

- [ ] **Step 2: Add `shouldSparkline` and `shouldTip` constants**

Najdi v `~/.claude/hooks/session-context.js` blok kolem řádků 30-33 (kde se definuje `shouldBanner`):

```javascript
  // Figlet banner — jen na startup a pokud je to git repo / reálný projekt, ne generic složka.
  const shouldBanner = config.banner.showFiglet
    && source === 'startup'
    && (git.inRepo || proj.hasPackageJson);
```

Hned za tento `const shouldBanner` blok (před `if (shouldBanner) {`) přidej dva nové constants. Použij Edit:

**old_string:**
```
  const shouldBanner = config.banner.showFiglet
    && source === 'startup'
    && (git.inRepo || proj.hasPackageJson);

  if (shouldBanner) {
```

**new_string:**
```
  const shouldBanner = config.banner.showFiglet
    && source === 'startup'
    && (git.inRepo || proj.hasPackageJson);

  // Sparkline jen na startup a compact (compact = Claude lost context, potřebuje orientaci).
  const shouldSparkline = source === 'startup' || source === 'compact';
  // Welcome tip jen na startup — resume/clear/compact znamenají, že user už ví co dělá.
  const shouldTip = source === 'startup' && config.banner.showWelcomeTip;

  if (shouldBanner) {
```

- [ ] **Step 3: Use `shouldSparkline` v git panel sparkline bloku**

Najdi blok kolem řádků 55-65 (sparkline + top 3 commits):

```javascript
    // Sparkline posledních commitů (pokud jsou)
    if (git.recentCommits && git.recentCommits.length > 0) {
      const sizes = git.recentCommits.map(c => c.additions + c.deletions).reverse();
      const spark = theme.sparkline(sizes);
      panelLines.push(`${g.doc} posledních ${git.recentCommits.length} commitů ${spark}`);

      const topN = git.recentCommits.slice(0, 3);
      for (const c of topN) {
        panelLines.push(`   ${c.hash} ${c.subject}`);
      }
    }
```

Zaobalit ho do `shouldSparkline` podmínky. Edit:

**old_string:**
```
    // Sparkline posledních commitů (pokud jsou)
    if (git.recentCommits && git.recentCommits.length > 0) {
      const sizes = git.recentCommits.map(c => c.additions + c.deletions).reverse();
      const spark = theme.sparkline(sizes);
      panelLines.push(`${g.doc} posledních ${git.recentCommits.length} commitů ${spark}`);

      const topN = git.recentCommits.slice(0, 3);
      for (const c of topN) {
        panelLines.push(`   ${c.hash} ${c.subject}`);
      }
    }
```

**new_string:**
```
    // Sparkline posledních commitů (pokud jsou) — jen na startup/compact
    if (shouldSparkline && git.recentCommits && git.recentCommits.length > 0) {
      const sizes = git.recentCommits.map(c => c.additions + c.deletions).reverse();
      const spark = theme.sparkline(sizes);
      panelLines.push(`${g.doc} posledních ${git.recentCommits.length} commitů ${spark}`);

      const topN = git.recentCommits.slice(0, 3);
      for (const c of topN) {
        panelLines.push(`   ${c.hash} ${c.subject}`);
      }
    }
```

- [ ] **Step 4: Use `shouldTip` ve git panel welcome tip bloku**

Najdi blok kolem řádků 71-74:

```javascript
    if (config.banner.showWelcomeTip) {
      panelLines.push('');
      panelLines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
```

Edit:

**old_string:**
```
    if (config.banner.showWelcomeTip) {
      panelLines.push('');
      panelLines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
```

**new_string:**
```
    if (shouldTip) {
      panelLines.push('');
      panelLines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
```

- [ ] **Step 5: Použít `shouldTip` taky v non-git fallback bloku**

Najdi blok kolem řádků 84-88 (else větev pro "není git repo"):

```javascript
    // Není git repo
    const lines = [`${g.info} Složka není git repo`];
    if (config.banner.showWelcomeTip) {
      lines.push('');
      lines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
```

Edit:

**old_string:**
```
    // Není git repo
    const lines = [`${g.info} Složka není git repo`];
    if (config.banner.showWelcomeTip) {
      lines.push('');
      lines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
```

**new_string:**
```
    // Není git repo
    const lines = [`${g.info} Složka není git repo`];
    if (shouldTip) {
      lines.push('');
      lines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
```

- [ ] **Step 6: Run test — expect PASS (all 4 cases green)**

Run: `node ~/.claude/hooks/session-context.test.js`

Expected: exit 0, output:
```
PASS [source=startup]
PASS [source=resume]
PASS [source=clear]
PASS [source=compact]

All 4 source cases pass
```

- [ ] **Step 7: Manuální smoke — porovnání délky startup vs resume**

Run:
```bash
echo '{"source":"startup","cwd":"/c/Users/admin/.claude"}' | node ~/.claude/hooks/session-context.js | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const o=JSON.parse(s);console.log('startup ctx length:',o.hookSpecificOutput.additionalContext.length)})"
echo '{"source":"resume","cwd":"/c/Users/admin/.claude"}'  | node ~/.claude/hooks/session-context.js | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const o=JSON.parse(s);console.log('resume ctx length:',o.hookSpecificOutput.additionalContext.length)})"
```

Expected: `startup ctx length:` číslo je VĚTŠÍ než `resume ctx length:` (rozdíl ~200-500 chars, řád stovek tokenů).

- [ ] **Step 8: Commit**

```bash
cd ~/.claude
git add hooks/session-context.js
git commit -m "feat(session-context): source-aware banner/sparkline/tip

startup: full (jako dosud)
resume/clear: skip sparkline + tip (rebuild kontextu nepotřebuje history+chrome)
compact: skip tip, keep sparkline (Claude lost context, potřebuje orientaci)"
```

---

### Task 4: Win 3 RED — detect-triggers.test.js expansion

**Files:**
- Modify: `~/.claude/hooks/detect-triggers.test.js`

- [ ] **Step 1: Read current state**

Run: `cat ~/.claude/hooks/detect-triggers.test.js`

Expected: existující soubor, jeden single-case test pro token-aware reminder (kontroluje 6 agent names).

- [ ] **Step 2: Rewrite test as multi-case framework**

Rewrite `~/.claude/hooks/detect-triggers.test.js` celý — exact content:

```javascript
#!/usr/bin/env node
// Tests detect-triggers.js produces correct hints/reminders for various prompts.
//
// Original case: token-aware reminder lists 6 pre-bind agent names (Sub-projekt A).
// Win 3 cases (Sub-projekt B): skill hints for tsc/security/visual phrases.
// Negative case: innocent prompt produces no skill hints.

const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const HOOK = path.join(os.homedir(), '.claude', 'hooks', 'detect-triggers.js');

function runHook(prompt) {
  const input = JSON.stringify({ prompt, cwd: process.cwd() });
  const result = spawnSync('node', [HOOK], { input, encoding: 'utf8' });
  if (result.status !== 0) {
    return { error: `non-zero exit (${result.status}): ${result.stderr}` };
  }
  if (!result.stdout.trim()) {
    // No match → hook exits 0 with empty stdout. Treat as empty context.
    return { ctx: '' };
  }
  let parsed;
  try { parsed = JSON.parse(result.stdout); }
  catch { return { error: `invalid JSON: ${result.stdout.slice(0,200)}` }; }
  return { ctx: parsed?.hookSpecificOutput?.additionalContext || '' };
}

const cases = [
  {
    name: 'token-aware reminder with 6 agent names',
    prompt: 'rozdělej to na agenty a naplánuj refactor X',
    mustContain: [
      'implementer-mech', 'implementer-multi',
      'spec-reviewer', 'code-reviewer',
      'dead-code-scanner', 'architect',
      '~/.claude/agents/',
    ],
    mustNotContain: [],
  },
  {
    name: 'tsc skill hint on "spusť tsc"',
    prompt: 'spusť tsc check na projektu',
    mustContain: ['tsc-verification'],
    mustNotContain: [],
  },
  {
    name: 'security skill hint on "bezpečnostní audit"',
    prompt: 'udělej bezpečnostní audit projektu',
    mustContain: ['security-audit'],
    mustNotContain: [],
  },
  {
    name: 'visual skill hint on "visual audit + wcag"',
    prompt: 'chci visual audit s wcag kontrolou',
    mustContain: ['visual-audit'],
    mustNotContain: [],
  },
  {
    name: 'no skill hint on innocent prompt',
    prompt: 'hello world, jak se máš?',
    mustContain: [],
    mustNotContain: ['tsc-verification', 'security-audit', 'visual-audit'],
  },
];

let failed = 0;
for (const c of cases) {
  const r = runHook(c.prompt);
  if (r.error) {
    console.error(`FAIL [${c.name}]: ${r.error}`);
    failed++;
    continue;
  }
  const issues = [];
  for (const m of c.mustContain) {
    if (!r.ctx.includes(m)) issues.push(`missing "${m}"`);
  }
  for (const m of c.mustNotContain) {
    if (r.ctx.includes(m)) issues.push(`should NOT contain "${m}"`);
  }
  if (issues.length > 0) {
    console.error(`FAIL [${c.name}]: ${issues.join('; ')}`);
    failed++;
  } else {
    console.log(`PASS [${c.name}]`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases pass`);
process.exit(0);
```

- [ ] **Step 3: Run test — expect FAIL (3 new cases fail, original still passes)**

Run: `node ~/.claude/hooks/detect-triggers.test.js`

Expected: exit 1, output includes:
```
PASS [token-aware reminder with 6 agent names]
FAIL [tsc skill hint on "spusť tsc"]: missing "tsc-verification"
FAIL [security skill hint on "bezpečnostní audit"]: missing "security-audit"
FAIL [visual skill hint on "visual audit + wcag"]: missing "visual-audit"
PASS [no skill hint on innocent prompt]

3 of 5 cases failed
```

(Token-aware reminder funguje. 3 nové cases failnou protože hook ještě nemá skillHints. Negativní case passne protože hook neproduce skill names.)

- [ ] **Step 4: Commit test (TDD red)**

```bash
cd ~/.claude
git add hooks/detect-triggers.test.js
git commit -m "test(detect-triggers): rozšířený framework + 4 cases pro skill hints (TDD red)"
```

---

### Task 5: Win 3 GREEN — detect-triggers.js skillHints

**Files:**
- Modify: `~/.claude/hooks/detect-triggers.js`

- [ ] **Step 1: Read current state to confirm insertion point**

Run: `cat ~/.claude/hooks/detect-triggers.js | head -50`

Expected: vidíš `tokenTriggers` + `timeTriggers` definice (lines ~27-41), pak `const tokenMatch = firstMatch(...)` (řádek ~43).

- [ ] **Step 2: Add `skillHints` definition + match logic**

V `~/.claude/hooks/detect-triggers.js` najdi řádek `const timeTriggers = [` (cca řádek 37) a celý jeho blok končící `];`. Hned ZA tento `];` (před řádkem `const tokenMatch = firstMatch...`) vlož novou `skillHints` definici.

**old_string:**
```
  const timeTriggers = [
    'jak dlouho', 'kolik to zabere', 'kolik zabere', 'odhad', 'odhadni',
    'naplánuj', 'rozplánuj', 'roadmap', 'plan this', 'break down',
    'how long', 'estimate', 'estimation',
  ];

  const tokenMatch = firstMatch(prompt, tokenTriggers);
  const timeMatch = firstMatch(prompt, timeTriggers);

  if (!tokenMatch && !timeMatch) process.exit(0);
```

**new_string:**
```
  const timeTriggers = [
    'jak dlouho', 'kolik to zabere', 'kolik zabere', 'odhad', 'odhadni',
    'naplánuj', 'rozplánuj', 'roadmap', 'plan this', 'break down',
    'how long', 'estimate', 'estimation',
  ];

  // Win 3: konzervativní task-phrase hinty pro under-triggered skills.
  // Multi-word phrases jen — single-word triggery by způsobily false positives.
  const skillHints = [
    {
      name: 'tsc-verification',
      keywords: ['tsc check', 'kompiluje', 'npx tsc', 'spusť tsc', 'tsc --noemit'],
    },
    {
      name: 'security-audit',
      keywords: ['zkontroluj bezpečnost', 'bezpečnostní audit', 'audit kódu', 'najdi zranitelnosti', 'security audit', 'security review'],
    },
    {
      name: 'visual-audit',
      keywords: ['vizuální audit', 'visual audit', 'wcag', 'ui audit', 'projdi ui', 'kontrast audit'],
    },
  ];

  const tokenMatch = firstMatch(prompt, tokenTriggers);
  const timeMatch = firstMatch(prompt, timeTriggers);
  const matchedSkills = skillHints
    .filter(s => s.keywords.some(kw => prompt.includes(kw)))
    .map(s => `[Hint] Skill \`${s.name}\` may apply for this task.`);

  if (!tokenMatch && !timeMatch && matchedSkills.length === 0) process.exit(0);
```

- [ ] **Step 3: Append skill hints to `sections` array**

Najdi blok kolem řádku 67 (po `if (timeMatch) { ... }` push):

```javascript
  if (timeMatch) {
    const cwd = data?.cwd || data?.workspace?.current_dir || process.cwd();
    const repo = resolveRepoSafely(cwd);
    const timeBlock = buildTimeBlock(repo);
    if (timeBlock) sections.push(timeBlock);
  }

  if (sections.length === 0) process.exit(0);
```

Edit — přidej skillHints push mezi `if (timeMatch)` a `if (sections.length === 0)`:

**old_string:**
```
  if (timeMatch) {
    const cwd = data?.cwd || data?.workspace?.current_dir || process.cwd();
    const repo = resolveRepoSafely(cwd);
    const timeBlock = buildTimeBlock(repo);
    if (timeBlock) sections.push(timeBlock);
  }

  if (sections.length === 0) process.exit(0);
```

**new_string:**
```
  if (timeMatch) {
    const cwd = data?.cwd || data?.workspace?.current_dir || process.cwd();
    const repo = resolveRepoSafely(cwd);
    const timeBlock = buildTimeBlock(repo);
    if (timeBlock) sections.push(timeBlock);
  }

  if (matchedSkills.length > 0) {
    sections.push(matchedSkills.join('\n'));
  }

  if (sections.length === 0) process.exit(0);
```

- [ ] **Step 4: Run test — expect PASS (all 5 cases green)**

Run: `node ~/.claude/hooks/detect-triggers.test.js`

Expected: exit 0:
```
PASS [token-aware reminder with 6 agent names]
PASS [tsc skill hint on "spusť tsc"]
PASS [security skill hint on "bezpečnostní audit"]
PASS [visual skill hint on "visual audit + wcag"]
PASS [no skill hint on innocent prompt]

All 5 cases pass
```

- [ ] **Step 5: Smoke test — manuální verify hook output for one skill hint**

Run:
```bash
echo '{"prompt":"chci spusť tsc check","cwd":"."}' | node ~/.claude/hooks/detect-triggers.js
```

Expected output (JSON), `additionalContext` field obsahuje řetězec `[Hint] Skill \`tsc-verification\` may apply for this task.`

- [ ] **Step 6: Commit**

```bash
cd ~/.claude
git add hooks/detect-triggers.js
git commit -m "feat(detect-triggers): skill hints pro tsc/security/visual phrases

Konzervativní multi-word triggery (žádné single-word false positives).
Output jednořádkové hinty, nereplikuje SKILL.md content.
Scaffold pro budoucí expanzi pod-triggered skills."
```

---

### Task 6: Integration verification

**Files:** (read-only — žádné změny)

- [ ] **Step 1: Run all tests — žádná regrese**

```bash
node ~/.claude/scripts/agent-stats.test.js
node ~/.claude/scripts/validate-agents.test.js
node ~/.claude/hooks/detect-triggers.test.js
node ~/.claude/hooks/session-context.test.js
```

Expected: všechny 4 commands exit 0. Žádné FAIL výstupy.

- [ ] **Step 2: Manuální size comparison — verify Win 2 efektivita**

Run:
```bash
for src in startup resume clear compact; do
  echo -n "source=$src ctx length: "
  echo "{\"source\":\"$src\",\"cwd\":\"/c/Users/admin/.claude\"}" \
    | node ~/.claude/hooks/session-context.js \
    | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const o=JSON.parse(s);console.log(o.hookSpecificOutput.additionalContext.length)})"
done
```

Expected: ordering by length: `startup > compact > resume ≈ clear`. Concrete numbers:
- `startup`: ~500-700 chars
- `compact`: ~400-600 chars (skip tip, keep sparkline)
- `resume` / `clear`: ~200-400 chars (skip tip + sparkline)

- [ ] **Step 3: Manuální verify Win 1 — settings.json claudeMdExcludes accessible**

Run: `node -e "const p=JSON.parse(require('fs').readFileSync('/c/Users/admin/.claude/settings.json','utf8'));console.log(p.claudeMdExcludes.join('\n'))"`

Expected stdout:
```
**/node_modules/**/CLAUDE.md
**/.claude/plugins/cache/**/CLAUDE.md
**/.claude/skills/trailofbits/CLAUDE.md
```

- [ ] **Step 4: Final git status & log sanity**

Run:
```bash
git -C ~/.claude status --short
git -C ~/.claude log --oneline -6
```

Expected:
- `git status` clean (no uncommitted)
- `git log` shows ~6 commits with Sub-projekt B titles: `feat(detect-triggers): skill hints...`, `test(detect-triggers): ...`, `feat(session-context): ...`, `test(session-context): ...`, `feat(settings): claudeMdExcludes`, plus prior spec commit

---

## Self-review checklist (po dokončení všech tasků)

- [ ] `settings.json` má pole `claudeMdExcludes` s 3 patterns; jiné fields netknuté.
- [ ] `session-context.js` má `shouldSparkline` + `shouldTip` constants použité ve všech 3 render bodech (git-panel sparkline, git-panel tip, non-git-fallback tip).
- [ ] `session-context.test.js` testuje všechny 4 source values (startup/resume/clear/compact), exit 0.
- [ ] `detect-triggers.js` má `skillHints` array s 3 položkami + match logic spojený do `sections`.
- [ ] `detect-triggers.test.js` má 5 cases (1 token-aware reminder + 3 skill hint positive + 1 negative), exit 0.
- [ ] Existující testy (`agent-stats.test.js`, `validate-agents.test.js`) pořád zelené — žádná regrese.
- [ ] Manuální size comparison ukazuje očekávané ordering (startup > compact > resume ≈ clear).
- [ ] `git status` čisté.

## Success kritéria (delayed — 2 týdny po implementaci)

Per spec §10:

- Pre/post measurement z `cache/cost-cache.json` agreguj náklady za session-start tokens před a po implementaci. Cíl: 5-10% pokles average per-session start cost.
- Pokud measurement <5%: prozkoumej proč (možná typický workload nepřechází resume/clear často, nebo claudeMdExcludes nepokrývá problematické cesty které ve skutečnosti loadují).
