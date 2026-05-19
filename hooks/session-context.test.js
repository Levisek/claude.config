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
