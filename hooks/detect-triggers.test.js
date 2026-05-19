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
