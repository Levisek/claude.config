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
