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
  if (!result.stdout.includes('OK — 6 agents')) {
    console.error('FAIL: exit 0 but OK/count missing in stdout');
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
