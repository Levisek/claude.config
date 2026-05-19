# Memory Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 wins memory-lifecycle: SessionEnd log writer, PreCompact state snapshot, SessionStart memory pull + compact replay, test-gate na `git push` (z auto-tsc cache).

**Architecture:** Per-win nový hook v `~/.claude/hooks/` + extend existing `session-context.js`. Mechanické (no LLM), čte/píše existující infra (`logs/`, `cache/`, `projects/<repo>/memory/`). TDD red→green per hook. Settings.json wire-up jako finální step.

**Tech Stack:** Node.js (hooks + testy přes spawnSync), JSON (cache+settings), Markdown (memory file output). Žádné nové dependencies.

**Sériový ordering:** každý hook má vlastní RED→GREEN cyklus. Task 1 (lib helper) je foundation. Task 7 (settings) musí být POSLEDNÍ aby SessionEnd/PreCompact events nefiruly před tím, než jsou hooky hotové.

---

### Task 1: Helper lib — repo-path.js (encoder + test)

**Files:**
- Create: `~/.claude/lib/repo-path.js`
- Create: `~/.claude/lib/repo-path.test.js`

- [ ] **Step 1: Write the failing test FIRST**

Vytvoř `~/.claude/lib/repo-path.test.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// Tests encodeRepoPath matches Anthropic's projects/<encoded>/ naming convention.

const path = require('path');
const os = require('os');

const { encodeRepoPath } = require(path.join(os.homedir(), '.claude', 'lib', 'repo-path.js'));

const cases = [
  { in: 'C:\\Users\\admin\\.claude',                  out: 'C--Users-admin--claude' },
  { in: 'C:\\dev\\FPLPro',                            out: 'C--dev-FPLPro' },
  { in: 'C:\\dev\\_Gral_Aitomated web builder',       out: 'C--dev--Gral-Aitomated-web-builder' },
  { in: 'C:\\dev\\Tabulka MS',                        out: 'C--dev-Tabulka-MS' },
  { in: 'C:\\Windows\\System32',                      out: 'C--Windows-System32' },
];

let failed = 0;
for (const c of cases) {
  const got = encodeRepoPath(c.in);
  if (got === c.out) {
    console.log(`PASS  ${c.in}  →  ${got}`);
  } else {
    console.error(`FAIL  ${c.in}  →  got "${got}", expected "${c.out}"`);
    failed++;
  }
}
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test — expect FAIL (module doesn't exist)**

Run: `node ~/.claude/lib/repo-path.test.js`

Expected: exit non-zero, error `Cannot find module '...repo-path.js'`.

- [ ] **Step 3: Implement the encoder**

Vytvoř `~/.claude/lib/repo-path.js` s EXACT obsahem:

```javascript
// Encode cwd → Anthropic's `projects/<encoded>` naming convention.
// Verified against existing dirs: C:\Users\admin\.claude → C--Users-admin--claude
// Replacements (sequential, no collision concerns since each maps to '-'):
//   ':' → '-'   (colon, Windows drive)
//   '\\' '/' → '-'   (path separators)
//   '.' → '-'   (dots, e.g. ".claude")
//   '_' → '-'   (underscores)
//   ' ' → '-'   (spaces)
// Result: chained dashes preserved (e.g. "C:\\dev\\.x" → "C--dev--x").

function encodeRepoPath(cwd) {
  return String(cwd)
    .replace(/:/g, '-')
    .replace(/[\\/]/g, '-')
    .replace(/\./g, '-')
    .replace(/[_ ]/g, '-');
}

module.exports = { encodeRepoPath };
```

- [ ] **Step 4: Run test — expect PASS**

Run: `node ~/.claude/lib/repo-path.test.js`

Expected: exit 0, all 5 cases PASS.

- [ ] **Step 5: Verify against actual dirs**

Run:
```bash
node -e "
const path=require('path');const os=require('os');const fs=require('fs');
const {encodeRepoPath}=require(path.join(os.homedir(),'.claude','lib','repo-path.js'));
const projectsDir=path.join(os.homedir(),'.claude','projects');
const samples=['C:\\\\Users\\\\admin\\\\.claude','C:\\\\dev\\\\FPLPro','C:\\\\Windows\\\\System32'];
for(const s of samples){
  const enc=encodeRepoPath(s);
  const exists=fs.existsSync(path.join(projectsDir,enc));
  console.log(enc, exists ? 'EXISTS in projects/' : 'NOT FOUND (OK if no past session)');
}
"
```

Expected: První 2 výsledky `EXISTS in projects/` (session-y už proběhly). Třetí může být buď `EXISTS` nebo `NOT FOUND`.

- [ ] **Step 6: Commit**

```bash
cd ~/.claude
git add lib/repo-path.js lib/repo-path.test.js
git commit -m "feat(lib): repo-path encoder pro projects/<encoded> directory naming"
```

---

### Task 2: SessionEnd flow — start marker + SessionEnd hook

**Files:**
- Modify: `~/.claude/hooks/session-context.js` (přidat start marker write)
- Create: `~/.claude/hooks/session-end.js`
- Create: `~/.claude/hooks/session-end.test.js`

- [ ] **Step 1: Write SessionEnd test FIRST**

Vytvoř `~/.claude/hooks/session-end.test.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// Tests session-end.js writes session-log entry to projects/<repo>/memory/session-log.md
// when given a valid start marker.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(os.homedir(), '.claude', 'hooks', 'session-end.js');
const { encodeRepoPath } = require(path.join(os.homedir(), '.claude', 'lib', 'repo-path.js'));

const TEST_SESSION_ID = `test-session-end-${Date.now()}`;
const CWD = path.join(os.homedir(), '.claude');
const MARKER_PATH = path.join(os.homedir(), '.claude', 'cache', `session-start-${TEST_SESSION_ID}.json`);
const LOG_PATH = path.join(os.homedir(), '.claude', 'projects', encodeRepoPath(CWD), 'memory', 'session-log.md');

// Setup: write fake start marker 15 min ago
const startMarker = {
  ts: Date.now() - 15 * 60 * 1000,
  branch: 'master',
  headSha: 'abc1234',
  cwd: CWD,
};
fs.mkdirSync(path.dirname(MARKER_PATH), { recursive: true });
fs.writeFileSync(MARKER_PATH, JSON.stringify(startMarker));

// Capture log size before
const logSizeBefore = fs.existsSync(LOG_PATH) ? fs.statSync(LOG_PATH).size : 0;

// Run hook
const input = JSON.stringify({ session_id: TEST_SESSION_ID, cwd: CWD, reason: 'test' });
const result = spawnSync('node', [HOOK], { input, encoding: 'utf8' });

let failed = 0;

if (result.status !== 0) {
  console.error(`FAIL: hook exited non-zero (${result.status}): ${result.stderr}`);
  failed++;
}

// Verify log file grew
if (!fs.existsSync(LOG_PATH)) {
  console.error(`FAIL: log file not created at ${LOG_PATH}`);
  failed++;
} else {
  const logSizeAfter = fs.statSync(LOG_PATH).size;
  if (logSizeAfter <= logSizeBefore) {
    console.error(`FAIL: log file did not grow (before=${logSizeBefore}, after=${logSizeAfter})`);
    failed++;
  } else {
    const content = fs.readFileSync(LOG_PATH, 'utf8');
    if (!content.includes('## ')) {
      console.error('FAIL: log entry missing "## " heading');
      failed++;
    }
    if (!content.includes('branch: master')) {
      console.error('FAIL: log entry missing branch line');
      failed++;
    }
  }
}

// Verify marker cleanup (start marker should be deleted after consumption)
if (fs.existsSync(MARKER_PATH)) {
  console.error(`FAIL: start marker still exists after SessionEnd (should be deleted)`);
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log('PASS: session-end writes log entry + cleans up marker');
process.exit(0);
```

- [ ] **Step 2: Run test — expect FAIL (session-end.js doesn't exist)**

Run: `node ~/.claude/hooks/session-end.test.js`

Expected: exit non-zero. Likely error `Cannot find module` or `non-zero exit` from missing hook.

- [ ] **Step 3: Add start marker write to `session-context.js`**

V `~/.claude/hooks/session-context.js`, najdi řádek `const proj = projectInfo(cwd);` (cca řádek 25). Hned ZA `const git = gitInfo(cwd);` (cca řádek 26) přidej marker write logic. Použij Edit:

**old_string:**
```javascript
  const proj = projectInfo(cwd);
  const git = gitInfo(cwd);

  const parts = [];
```

**new_string:**
```javascript
  const proj = projectInfo(cwd);
  const git = gitInfo(cwd);

  // Write SessionStart marker pro pozdější SessionEnd hook (jen na startup).
  const sessionId = data?.session_id || '';
  if (sessionId && source === 'startup') {
    const fs = require('fs');
    const markerPath = path.join(os.homedir(), '.claude', 'cache', `session-start-${sessionId}.json`);
    const marker = {
      ts: Date.now(),
      branch: git.branch || null,
      headSha: git.recentCommits?.[0]?.hash || null,
      cwd: cwd,
    };
    try {
      fs.mkdirSync(path.dirname(markerPath), { recursive: true });
      fs.writeFileSync(markerPath, JSON.stringify(marker));
    } catch {}
  }

  const parts = [];
```

(Note: `fs` se v session-context.js nevolá jinak — `require('fs')` inline je OK, drží file zatím minimální.)

- [ ] **Step 4: Implement `session-end.js`**

Vytvoř `~/.claude/hooks/session-end.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// SessionEnd hook — appendne mechanický session log entry do projects/<repo>/memory/session-log.md.
// Čte start marker z cache, dopočítá deltu (commits, duration), agreguje agent dispatches z logs.
// No LLM — pure data aggregation.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOME = os.homedir();
const { encodeRepoPath } = require(path.join(HOME, '.claude', 'lib', 'repo-path.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const sessionId = data?.session_id || '';
  const cwd = data?.cwd || process.cwd();
  if (!sessionId) process.exit(0);

  // Read start marker
  const markerPath = path.join(HOME, '.claude', 'cache', `session-start-${sessionId}.json`);
  let marker = null;
  try { marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch {}

  if (!marker) process.exit(0); // No marker → skip (likely resume/clear session)

  // Verify cwd is git repo
  let toplevel;
  try {
    toplevel = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 }).trim();
  } catch { process.exit(0); }

  // Compute deltas
  const startTs = marker.ts;
  const endTs = Date.now();
  const durationMin = Math.round((endTs - startTs) / 60000);

  // Commits since start
  let commitsCount = 0;
  let commitRange = '';
  if (marker.headSha) {
    try {
      const out = execSync(`git log ${marker.headSha}..HEAD --oneline`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
      const lines = out.split('\n').filter(l => l.trim());
      commitsCount = lines.length;
      if (commitsCount > 0) {
        const firstSha = lines[lines.length - 1].split(' ')[0];
        const lastSha = lines[0].split(' ')[0];
        commitRange = `${firstSha}..${lastSha}`;
      }
    } catch {}
  }

  // Current branch
  let branch = marker.branch || 'unknown';
  try {
    branch = execSync('git branch --show-current', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 }).trim() || branch;
  } catch {}

  // Dirty count
  let dirtyCount = 0;
  try {
    const out = execSync('git status --short', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 });
    dirtyCount = out.split('\n').filter(l => l.trim()).length;
  } catch {}

  // Agent dispatches v okně [startTs, endTs]
  const durationsPath = path.join(HOME, '.claude', 'logs', 'agent-durations.jsonl');
  const agentsByModel = { haiku: 0, sonnet: 0, opus: 0, other: 0 };
  let agentsTotal = 0;
  try {
    const raw = fs.readFileSync(durationsPath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        const ts = new Date(e.ts || e.ts_start || 0).getTime();
        if (ts >= startTs && ts <= endTs) {
          agentsTotal++;
          const m = String(e.model || '').toLowerCase();
          if (m.includes('haiku')) agentsByModel.haiku++;
          else if (m.includes('sonnet')) agentsByModel.sonnet++;
          else if (m.includes('opus')) agentsByModel.opus++;
          else agentsByModel.other++;
        }
      } catch {}
    }
  } catch {}

  // Format entry
  const startDate = new Date(startTs);
  const endDate = new Date(endTs);
  const dateStr = startDate.toISOString().slice(0, 10);
  const startTime = startDate.toTimeString().slice(0, 5);
  const endTime = endDate.toTimeString().slice(0, 5);

  const lines = [];
  lines.push(`## ${dateStr} ${startTime}–${endTime} (${durationMin} min)`);
  lines.push(`- branch: ${branch}`);
  if (commitsCount > 0) {
    lines.push(`- commits: ${commitsCount} (${commitRange})`);
  } else {
    lines.push('- commits: 0');
  }
  if (agentsTotal > 0) {
    const breakdown = ['haiku', 'sonnet', 'opus', 'other']
      .filter(m => agentsByModel[m] > 0)
      .map(m => `${agentsByModel[m]} ${m}`)
      .join(', ');
    lines.push(`- agents: ${agentsTotal} dispatches (${breakdown})`);
  }
  lines.push(`- exit: ${dirtyCount === 0 ? 'clean' : `${dirtyCount} uncommitted`}`);
  const entry = lines.join('\n') + '\n\n';

  // Append to session-log.md
  const memoryDir = path.join(HOME, '.claude', 'projects', encodeRepoPath(cwd), 'memory');
  const logPath = path.join(memoryDir, 'session-log.md');
  try {
    fs.mkdirSync(memoryDir, { recursive: true });
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '# Session log\n\n');
    }
    fs.appendFileSync(logPath, entry);
  } catch {}

  // Cleanup marker
  try { fs.unlinkSync(markerPath); } catch {}

  process.exit(0);
});
```

- [ ] **Step 5: Run test — expect PASS**

Run: `node ~/.claude/hooks/session-end.test.js`

Expected: exit 0, `PASS: session-end writes log entry + cleans up marker`.

- [ ] **Step 6: Verify written entry visually**

Run:
```bash
node -e "
const path=require('path');const os=require('os');
const {encodeRepoPath}=require(path.join(os.homedir(),'.claude','lib','repo-path.js'));
const fs=require('fs');
const p=path.join(os.homedir(),'.claude','projects',encodeRepoPath(path.join(os.homedir(),'.claude')),'memory','session-log.md');
console.log(fs.readFileSync(p,'utf8').split('\n').slice(-15).join('\n'));
"
```

Expected: vidíš nejnovější entry z testu (date, branch: master, commits: 0, exit: ...).

- [ ] **Step 7: Commit**

```bash
cd ~/.claude
git add hooks/session-context.js hooks/session-end.js hooks/session-end.test.js
git commit -m "feat(hooks): SessionStart marker + SessionEnd log writer

SessionStart zapíše start marker (timestamp, head SHA, branch) do cache.
SessionEnd načte marker, dopočítá deltu (commits, duration, agent dispatches),
appendne mechanický entry do projects/<repo>/memory/session-log.md."
```

---

### Task 3: PreCompact hook

**Files:**
- Create: `~/.claude/hooks/pre-compact.js`
- Create: `~/.claude/hooks/pre-compact.test.js`

- [ ] **Step 1: Write the test FIRST**

Vytvoř `~/.claude/hooks/pre-compact.test.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// Tests pre-compact.js writes state snapshot to cache/pre-compact-<sessionId>.json.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(os.homedir(), '.claude', 'hooks', 'pre-compact.js');
const TEST_SESSION_ID = `test-pre-compact-${Date.now()}`;
const CWD = path.join(os.homedir(), '.claude');
const SNAPSHOT_PATH = path.join(os.homedir(), '.claude', 'cache', `pre-compact-${TEST_SESSION_ID}.json`);

// Cleanup any previous
try { fs.unlinkSync(SNAPSHOT_PATH); } catch {}

const input = JSON.stringify({ session_id: TEST_SESSION_ID, cwd: CWD });
const result = spawnSync('node', [HOOK], { input, encoding: 'utf8' });

let failed = 0;

if (result.status !== 0) {
  console.error(`FAIL: hook exited non-zero (${result.status}): ${result.stderr}`);
  failed++;
}

if (!fs.existsSync(SNAPSHOT_PATH)) {
  console.error(`FAIL: snapshot not created at ${SNAPSHOT_PATH}`);
  failed++;
} else {
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  if (typeof snap.ts !== 'number') { console.error('FAIL: snap.ts missing or not number'); failed++; }
  if (!Array.isArray(snap.git_status)) { console.error('FAIL: snap.git_status must be array'); failed++; }
  if (!Array.isArray(snap.recent_commits)) { console.error('FAIL: snap.recent_commits must be array'); failed++; }
  if (!Array.isArray(snap.recent_agents)) { console.error('FAIL: snap.recent_agents must be array'); failed++; }
  if (snap.recent_commits.length === 0) {
    console.error('FAIL: recent_commits empty (test cwd should have commits)');
    failed++;
  } else {
    const first = snap.recent_commits[0];
    if (!first.hash || !first.subject) {
      console.error('FAIL: recent_commits[0] missing hash/subject');
      failed++;
    }
  }
}

// Cleanup
try { fs.unlinkSync(SNAPSHOT_PATH); } catch {}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('PASS: pre-compact writes valid snapshot');
process.exit(0);
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node ~/.claude/hooks/pre-compact.test.js`

Expected: exit non-zero (`Cannot find module` or non-zero hook exit).

- [ ] **Step 3: Implement `pre-compact.js`**

Vytvoř `~/.claude/hooks/pre-compact.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// PreCompact hook — zachytí state snapshot před compaction.
// Outputuje JSON do cache/pre-compact-<sessionId>.json. SessionStart (source=compact)
// ho přečte a replay-ne do additionalContext.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOME = os.homedir();
const CACHE_DIR = path.join(HOME, '.claude', 'cache');
const DURATIONS_PATH = path.join(HOME, '.claude', 'logs', 'agent-durations.jsonl');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const sessionId = data?.session_id || '';
  const cwd = data?.cwd || process.cwd();
  if (!sessionId) process.exit(0);

  // Git status
  const gitStatus = [];
  try {
    const out = execSync('git status --short', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 });
    for (const line of out.split('\n').slice(0, 20)) {
      const m = line.match(/^(.{2})\s+(.+)$/);
      if (m) gitStatus.push({ status: m[1].trim(), path: m[2] });
    }
  } catch {}

  // Recent commits (last 5)
  const recentCommits = [];
  try {
    const out = execSync('git log --oneline -5', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 });
    for (const line of out.split('\n')) {
      const m = line.match(/^(\w+)\s+(.+)$/);
      if (m) recentCommits.push({ hash: m[1], subject: m[2] });
    }
  } catch {}

  // Recent agent dispatches (last 5 by ts)
  const recentAgents = [];
  try {
    const raw = fs.readFileSync(DURATIONS_PATH, 'utf8');
    const entries = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch {}
    }
    entries.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    for (const e of entries.slice(0, 5)) {
      recentAgents.push({
        model: e.model || 'unknown',
        role: e.subagent_type || e.role || 'unknown',
        ts_start: e.ts || null,
      });
    }
  } catch {}

  const snapshot = {
    ts: Date.now(),
    git_status: gitStatus,
    recent_commits: recentCommits,
    recent_agents: recentAgents,
  };

  // Write
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const snapPath = path.join(CACHE_DIR, `pre-compact-${sessionId}.json`);
    fs.writeFileSync(snapPath, JSON.stringify(snapshot));
  } catch {}

  // Cleanup old snapshots (> 7 days)
  try {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!f.startsWith('pre-compact-') || !f.endsWith('.json')) continue;
      const full = path.join(CACHE_DIR, f);
      try {
        if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
      } catch {}
    }
  } catch {}

  process.exit(0);
});
```

- [ ] **Step 4: Run test — expect PASS**

Run: `node ~/.claude/hooks/pre-compact.test.js`

Expected: exit 0, `PASS: pre-compact writes valid snapshot`.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add hooks/pre-compact.js hooks/pre-compact.test.js
git commit -m "feat(hooks): PreCompact state snapshot pro post-compact replay

Zachytí git status, recent commits, recent agent dispatches do
cache/pre-compact-<sessionId>.json. Cleanup snapshots > 7 dní."
```

---

### Task 4: SessionStart memory pull + compact replay

**Files:**
- Modify: `~/.claude/hooks/session-context.js`
- Modify: `~/.claude/hooks/session-context.test.js`

- [ ] **Step 1: Extend test to assert memory pull**

V `~/.claude/hooks/session-context.test.js` najdi blok `const cases = [...]` a rozšiř o 2 nové asserts. Edit:

**old_string:**
```javascript
const cases = [
  { source: 'startup', mustContain: [TIP_ANCHOR, SPARK_ANCHOR], mustNotContain: [] },
  { source: 'resume',  mustContain: [],                          mustNotContain: [TIP_ANCHOR, SPARK_ANCHOR] },
  { source: 'clear',   mustContain: [],                          mustNotContain: [TIP_ANCHOR, SPARK_ANCHOR] },
  { source: 'compact', mustContain: [SPARK_ANCHOR],              mustNotContain: [TIP_ANCHOR] },
];
```

**new_string:**
```javascript
// Win 3 setup: vytvoř fake session-log.md entry pro memory pull test
const fs = require('fs');
const { encodeRepoPath } = require(path.join(os.homedir(), '.claude', 'lib', 'repo-path.js'));
const memoryDir = path.join(os.homedir(), '.claude', 'projects', encodeRepoPath(CWD), 'memory');
const logPath = path.join(memoryDir, 'session-log.md');
const SENTINEL = `__test-sentinel-${Date.now()}__`;
let restoredLog = null;
try {
  if (fs.existsSync(logPath)) restoredLog = fs.readFileSync(logPath, 'utf8');
  fs.mkdirSync(memoryDir, { recursive: true });
  fs.appendFileSync(logPath, `\n## 2026-05-19 10:00–10:30 (30 min) ${SENTINEL}\n- branch: master\n- commits: 1\n- exit: clean\n`);
} catch {}

const cases = [
  { source: 'startup', mustContain: [TIP_ANCHOR, SPARK_ANCHOR, SENTINEL], mustNotContain: [] },
  { source: 'resume',  mustContain: [],                                    mustNotContain: [TIP_ANCHOR, SPARK_ANCHOR, SENTINEL] },
  { source: 'clear',   mustContain: [],                                    mustNotContain: [TIP_ANCHOR, SPARK_ANCHOR, SENTINEL] },
  { source: 'compact', mustContain: [SPARK_ANCHOR, SENTINEL],              mustNotContain: [TIP_ANCHOR] },
];
```

A na samém konci souboru (přidat PŘED `process.exit(failed > 0 ? 1 : 0)`), přidej cleanup. Edit:

**old_string:**
```javascript
if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} source cases pass`);
process.exit(0);
```

**new_string:**
```javascript
// Cleanup: restore original session-log.md
try {
  if (restoredLog !== null) fs.writeFileSync(logPath, restoredLog);
  else fs.unlinkSync(logPath);
} catch {}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} source cases pass`);
process.exit(0);
```

- [ ] **Step 2: Run extended test — expect FAIL (no memory pull logic yet)**

Run: `node ~/.claude/hooks/session-context.test.js`

Expected: exit 1. Output should show startup case FAIL missing `__test-sentinel-...__`.

- [ ] **Step 3: Add memory pull + compact replay to `session-context.js`**

V `~/.claude/hooks/session-context.js`, najdi konec stdin handler (před `const context = parts.join('\n');`). Před tento řádek přidej memory pull + compact replay logic. Edit:

**old_string:**
```javascript
  const context = parts.join('\n');

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }));
  process.exit(0);
});
```

**new_string:**
```javascript
  // Memory pull — na startup a compact, inject poslední session-log entry
  const shouldPullMemory = (source === 'startup' || source === 'compact') && git.inRepo;
  if (shouldPullMemory) {
    try {
      const fs = require('fs');
      const { encodeRepoPath } = require(path.join(os.homedir(), '.claude', 'lib', 'repo-path.js'));
      const logPath = path.join(os.homedir(), '.claude', 'projects', encodeRepoPath(cwd), 'memory', 'session-log.md');
      const raw = fs.readFileSync(logPath, 'utf8');
      // Extract last `## ...` block
      const lastIdx = raw.lastIndexOf('\n## ');
      const lastBlock = lastIdx >= 0 ? raw.slice(lastIdx + 1) : '';
      const trimmed = lastBlock.trim().slice(0, 500);
      if (trimmed) {
        parts.push('\n**Previous session:**\n' + trimmed);
      }
    } catch {}
  }

  // Compact replay — jen pro compact, inject pre-compact snapshot
  if (source === 'compact' && sessionId) {
    try {
      const fs = require('fs');
      const snapPath = path.join(os.homedir(), '.claude', 'cache', `pre-compact-${sessionId}.json`);
      const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
      const replayLines = [
        `**Pre-compact state** (compacted at ${new Date(snap.ts).toISOString()}):`,
      ];
      for (const c of (snap.recent_commits || []).slice(0, 3)) {
        replayLines.push(`- ${c.hash} ${c.subject}`);
      }
      replayLines.push(`- ${(snap.git_status || []).length} dirty files, ${(snap.recent_agents || []).length} recent agents`);
      parts.push('\n' + replayLines.join('\n'));
    } catch {}
  }

  const context = parts.join('\n');

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }));
  process.exit(0);
});
```

- [ ] **Step 4: Run test — expect PASS (all 4 cases)**

Run: `node ~/.claude/hooks/session-context.test.js`

Expected: exit 0, all 4 source cases PASS including the new sentinel assertions.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add hooks/session-context.js hooks/session-context.test.js
git commit -m "feat(session-context): memory pull + compact replay

startup/compact: pull last session-log.md entry (max 500 chars).
compact: replay pre-compact snapshot (recent commits + agent count)."
```

---

### Task 5: test-gate hook

**Files:**
- Create: `~/.claude/hooks/test-gate.js`
- Create: `~/.claude/hooks/test-gate.test.js`

- [ ] **Step 1: Write the test FIRST**

Vytvoř `~/.claude/hooks/test-gate.test.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// Tests test-gate.js correctly blocks/allows `git push` based on tsc-status cache.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(os.homedir(), '.claude', 'hooks', 'test-gate.js');
const TEST_SESSION_ID = `test-test-gate-${Date.now()}`;
const STATUS_DIR = path.join(os.homedir(), '.claude', 'session-env', TEST_SESSION_ID);
const STATUS_PATH = path.join(STATUS_DIR, 'tsc-status');

function runHook(opts) {
  // opts: { command, statusFile, env }
  // Setup status file
  try { fs.rmSync(STATUS_DIR, { recursive: true, force: true }); } catch {}
  if (opts.statusFile) {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    fs.writeFileSync(STATUS_PATH, JSON.stringify(opts.statusFile));
  }
  const input = JSON.stringify({
    session_id: TEST_SESSION_ID,
    tool_input: { command: opts.command },
  });
  const result = spawnSync('node', [HOOK], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
  });
  return { code: result.status, stderr: result.stderr };
}

const cases = [
  {
    name: 'non-git-push command → allow',
    opts: { command: 'ls -la', statusFile: { ok: false, errors: 3, timestamp: Date.now() } },
    expectExit: 0,
  },
  {
    name: 'git push + no tsc status (non-TS project) → allow',
    opts: { command: 'git push origin master', statusFile: null },
    expectExit: 0,
  },
  {
    name: 'git push + tsc clean → allow',
    opts: { command: 'git push origin master', statusFile: { ok: true, errors: 0, timestamp: Date.now() } },
    expectExit: 0,
  },
  {
    name: 'git push + tsc errors (recent) → BLOCK',
    opts: { command: 'git push origin master', statusFile: { ok: false, errors: 3, timestamp: Date.now() } },
    expectExit: 2,
  },
  {
    name: 'git push + tsc errors (stale > 10 min) → allow',
    opts: { command: 'git push origin master', statusFile: { ok: false, errors: 3, timestamp: Date.now() - 11 * 60 * 1000 } },
    expectExit: 0,
  },
  {
    name: 'git push + tsc errors + SKIP_TEST_GATE → allow',
    opts: { command: 'git push origin master', statusFile: { ok: false, errors: 3, timestamp: Date.now() }, env: { SKIP_TEST_GATE: '1' } },
    expectExit: 0,
  },
];

let failed = 0;
for (const c of cases) {
  const r = runHook(c.opts);
  if (r.code !== c.expectExit) {
    console.error(`FAIL [${c.name}]: expected exit ${c.expectExit}, got ${r.code}; stderr: ${r.stderr.slice(0,200)}`);
    failed++;
  } else {
    console.log(`PASS [${c.name}]`);
  }
}

// Cleanup
try { fs.rmSync(STATUS_DIR, { recursive: true, force: true }); } catch {}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} test-gate cases pass`);
process.exit(0);
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node ~/.claude/hooks/test-gate.test.js`

Expected: exit non-zero (`Cannot find module` from missing hook).

- [ ] **Step 3: Implement `test-gate.js`**

Vytvoř `~/.claude/hooks/test-gate.js` s EXACT obsahem:

```javascript
#!/usr/bin/env node
// test-gate — PreToolUse Bash matcher. Blokuje `git push` při čerstvých tsc chybách.
// Čte cache z auto-tsc.js (session-env/<sessionId>/tsc-status). Instant, no test re-run.
//
// Bypass: SKIP_TEST_GATE=1 env var (logováno do test-gate-bypass.jsonl).
// TTL: pokud tsc-status starší než 10 min, treat as stale → allow (no false blocks).

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const TTL_MS = 10 * 60 * 1000;
const BYPASS_LOG = path.join(HOME, '.claude', 'logs', 'test-gate-bypass.jsonl');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const command = String(data?.tool_input?.command || '');
  const sessionId = data?.session_id || '';

  // Pass-through pro vše kromě `git push`
  if (!/^\s*git\s+push\b/.test(command)) {
    process.exit(0);
  }

  // Bypass
  if (process.env.SKIP_TEST_GATE === '1') {
    try {
      fs.mkdirSync(path.dirname(BYPASS_LOG), { recursive: true });
      fs.appendFileSync(BYPASS_LOG, JSON.stringify({
        ts: new Date().toISOString(),
        sessionId,
        command,
        reason: 'SKIP_TEST_GATE=1',
      }) + '\n');
    } catch {}
    process.exit(0);
  }

  // Read tsc-status cache
  if (!sessionId) process.exit(0);
  const statusPath = path.join(HOME, '.claude', 'session-env', sessionId, 'tsc-status');
  let status;
  try {
    status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch {
    process.exit(0); // No cache → not a TS project or no recent edit → allow
  }

  // Stale check
  if (typeof status.timestamp !== 'number' || (Date.now() - status.timestamp) > TTL_MS) {
    process.exit(0);
  }

  // OK check
  if (status.ok) {
    process.exit(0);
  }

  // BLOCK
  const errorCount = status.errors || '?';
  const fileRef = status.file ? ` in ${status.file}` : '';
  process.stderr.write(
    `BLOCKED: tsc reports ${errorCount} error(s)${fileRef} from last edit. ` +
    `Run /tsc to inspect, or set SKIP_TEST_GATE=1 to bypass (logged).\n`
  );
  process.exit(2);
});
```

- [ ] **Step 4: Run test — expect PASS (all 6 cases)**

Run: `node ~/.claude/hooks/test-gate.test.js`

Expected: exit 0, all 6 cases PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add hooks/test-gate.js hooks/test-gate.test.js
git commit -m "feat(hooks): test-gate na git push z auto-tsc cache

Čte session-env/<sessionId>/tsc-status (psané auto-tsc.js po každém Edit).
Block git push pokud čerstvé tsc chyby (TTL 10 min).
Bypass: SKIP_TEST_GATE=1 (audit-logged)."
```

---

### Task 6: settings.json wire-up

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Read current settings.json hooks section**

Run: `cat ~/.claude/settings.json`

Expected: vidíš `PreToolUse`, `PostToolUse`, `SessionStart`, `UserPromptSubmit` events. PreToolUse má matchers Bash, Write|Edit, Read|Glob|Grep, Agent.

- [ ] **Step 2: Add SessionEnd event**

V `~/.claude/settings.json` najdi `SessionStart` blok a hned ZA něj (před `UserPromptSubmit`) přidej SessionEnd. Edit:

**old_string:**
```json
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/admin/.claude/hooks/session-context.js"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
```

**new_string:**
```json
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/admin/.claude/hooks/session-context.js"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/admin/.claude/hooks/session-end.js"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/admin/.claude/hooks/pre-compact.js"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
```

- [ ] **Step 3: Add test-gate.js k existujícímu Bash matcher v PreToolUse**

V `~/.claude/settings.json` najdi PreToolUse Bash matcher. Edit:

**old_string:**
```json
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/admin/.claude/hooks/block-destructive.js"
          }
        ]
      },
```

**new_string:**
```json
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/admin/.claude/hooks/block-destructive.js"
          },
          {
            "type": "command",
            "command": "node C:/Users/admin/.claude/hooks/test-gate.js"
          }
        ]
      },
```

- [ ] **Step 4: Verify JSON parses + event counts**

Run:
```bash
node -e "
const fs=require('fs');const os=require('os');
const p=JSON.parse(fs.readFileSync(os.homedir()+'/.claude/settings.json','utf8'));
console.log('Hook events:',Object.keys(p.hooks).join(', '));
console.log('PreToolUse Bash hooks count:',p.hooks.PreToolUse.find(m=>m.matcher==='Bash').hooks.length);
console.log('SessionEnd configured:',!!p.hooks.SessionEnd);
console.log('PreCompact configured:',!!p.hooks.PreCompact);
"
```

Expected:
```
Hook events: PreToolUse, PostToolUse, SessionStart, SessionEnd, PreCompact, UserPromptSubmit
PreToolUse Bash hooks count: 2
SessionEnd configured: true
PreCompact configured: true
```

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add settings.json
git commit -m "feat(settings): wire SessionEnd + PreCompact + test-gate hooks

SessionEnd → session-end.js (log writer)
PreCompact → pre-compact.js (state snapshot)
PreToolUse Bash → block-destructive + test-gate (řazeno: destructive first)"
```

---

### Task 7: Integration verification

**Files:** (read-only — žádné změny)

- [ ] **Step 1: All tests green**

Run:
```bash
node ~/.claude/lib/repo-path.test.js
node ~/.claude/scripts/agent-stats.test.js
node ~/.claude/scripts/validate-agents.test.js
node ~/.claude/hooks/detect-triggers.test.js
node ~/.claude/hooks/session-context.test.js
node ~/.claude/hooks/session-end.test.js
node ~/.claude/hooks/pre-compact.test.js
node ~/.claude/hooks/test-gate.test.js
```

Expected: každá z 8 commands exit 0. Žádné FAIL.

- [ ] **Step 2: Verify all hooks fileable + executable**

Run:
```bash
ls -la ~/.claude/hooks/*.js | awk '{print $NF}'
```

Expected: 11 files (10 původních + 3 nové: session-end.js, pre-compact.js, test-gate.js).

- [ ] **Step 3: Smoke test SessionEnd flow end-to-end**

Tento step simuluje plnou flow bez čekání na reálnou session ukončení.

Run:
```bash
# 1) Simulate SessionStart (writes marker)
SESSION_ID="smoke-$(date +%s)"
echo "{\"session_id\":\"$SESSION_ID\",\"source\":\"startup\",\"cwd\":\"$(cygpath -w ~/.claude)\"}" \
  | node ~/.claude/hooks/session-context.js > /dev/null

# 2) Verify marker exists
ls -la ~/.claude/cache/session-start-$SESSION_ID.json && echo "marker OK"

# 3) Simulate SessionEnd
echo "{\"session_id\":\"$SESSION_ID\",\"cwd\":\"$(cygpath -w ~/.claude)\"}" \
  | node ~/.claude/hooks/session-end.js

# 4) Verify marker cleaned up
[ ! -f ~/.claude/cache/session-start-$SESSION_ID.json ] && echo "marker cleaned up"

# 5) Verify entry appended to session-log.md
tail -10 ~/.claude/projects/C--Users-admin--claude/memory/session-log.md
```

Expected:
- `marker OK` printed
- `marker cleaned up` printed
- `tail` shows new `## YYYY-MM-DD HH:MM` entry with branch master + exit line

- [ ] **Step 4: Git status clean + log review**

Run:
```bash
git -C ~/.claude status --short
git -C ~/.claude log --oneline -10
```

Expected:
- `git status` empty (clean)
- 6 new feat/test commits z Sub-projektu C (plus spec + plan).

- [ ] **Step 5: Final settings audit**

Run:
```bash
node -e "
const fs=require('fs');const os=require('os');
const p=JSON.parse(fs.readFileSync(os.homedir()+'/.claude/settings.json','utf8'));
console.log('=== Hook events ===');
for(const ev of Object.keys(p.hooks)){
  const matchers=p.hooks[ev];
  for(const m of matchers){
    const hookFiles=(m.hooks||[]).map(h=>h.command.split('/').pop()).join(', ');
    console.log(\`  \${ev}\${m.matcher?'['+m.matcher+']':''}: \${hookFiles}\`);
  }
}
"
```

Expected output musí zahrnout:
```
SessionEnd: session-end.js
PreCompact: pre-compact.js
PreToolUse[Bash]: block-destructive.js, test-gate.js
```

---

## Self-review checklist (po dokončení všech tasků)

- [ ] `lib/repo-path.js` exists + 5/5 test cases pass
- [ ] `hooks/session-end.js` exists + test passes + memory log entry verified
- [ ] `hooks/pre-compact.js` exists + test passes + snapshot JSON valid
- [ ] `hooks/session-context.js` rozšířený o marker write + memory pull + compact replay
- [ ] `hooks/session-context.test.js` rozšířený o sentinel asserts pro memory pull (4 cases all PASS)
- [ ] `hooks/test-gate.js` exists + 6/6 test cases pass (allow + block + bypass + stale)
- [ ] `settings.json` má SessionEnd, PreCompact events; PreToolUse Bash má 2 hooks
- [ ] Všech 8 testů exit 0 (regression check)
- [ ] Smoke test end-to-end: SessionStart → marker → SessionEnd → entry → cleanup

## Success kritéria (delayed — 2 týdny po implementaci)

Per spec §11:

- session-log.md entry count ≈ session count v daném repo (verify visual scan)
- test-gate `BLOCKED` event triggered alespoň 1× při reálné práci (sanity check že gate funguje)
- `test-gate-bypass.jsonl` bypass count < 5% celkových `git push` (sanity že gate není flaky)
- Pokud bypass count > 10% → indikuje stale cache problem nebo příliš agresivní TTL → revisit
