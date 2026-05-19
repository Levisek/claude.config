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
