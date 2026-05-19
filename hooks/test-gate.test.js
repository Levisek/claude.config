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
