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
