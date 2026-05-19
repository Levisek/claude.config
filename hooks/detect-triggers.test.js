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
