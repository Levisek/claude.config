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
