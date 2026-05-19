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
