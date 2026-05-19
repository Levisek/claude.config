#!/usr/bin/env node
// SessionEnd hook — appendne mechanický session log entry do projects/<repo>/memory/session-log.md.
// Čte start marker z cache, dopočítá deltu (commits, duration), agreguje agent dispatches z logs.
// No LLM — pure data aggregation.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOME = os.homedir();
const { encodeRepoPath } = require(path.join(HOME, '.claude', 'lib', 'repo-path.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const sessionId = data?.session_id || '';
  const cwd = data?.cwd || process.cwd();
  if (!sessionId) process.exit(0);

  // Read start marker
  const markerPath = path.join(HOME, '.claude', 'cache', `session-start-${sessionId}.json`);
  let marker = null;
  try { marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch {}

  if (!marker) process.exit(0); // No marker → skip (likely resume/clear session)

  // Verify cwd is git repo
  let toplevel;
  try {
    toplevel = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 }).trim();
  } catch { process.exit(0); }

  // Compute deltas
  const startTs = marker.ts;
  const endTs = Date.now();
  const durationMin = Math.round((endTs - startTs) / 60000);

  // Commits since start
  let commitsCount = 0;
  let commitRange = '';
  if (marker.headSha) {
    try {
      const out = execSync(`git log ${marker.headSha}..HEAD --oneline`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
      const lines = out.split('\n').filter(l => l.trim());
      commitsCount = lines.length;
      if (commitsCount > 0) {
        const firstSha = lines[lines.length - 1].split(' ')[0];
        const lastSha = lines[0].split(' ')[0];
        commitRange = `${firstSha}..${lastSha}`;
      }
    } catch {}
  }

  // Current branch
  let branch = marker.branch || 'unknown';
  try {
    branch = execSync('git branch --show-current', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 }).trim() || branch;
  } catch {}

  // Dirty count
  let dirtyCount = 0;
  try {
    const out = execSync('git status --short', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 });
    dirtyCount = out.split('\n').filter(l => l.trim()).length;
  } catch {}

  // Agent dispatches v okně [startTs, endTs]
  const durationsPath = path.join(HOME, '.claude', 'logs', 'agent-durations.jsonl');
  const agentsByModel = { haiku: 0, sonnet: 0, opus: 0, other: 0 };
  let agentsTotal = 0;
  try {
    const raw = fs.readFileSync(durationsPath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        const ts = new Date(e.ts || e.ts_start || 0).getTime();
        if (ts >= startTs && ts <= endTs) {
          agentsTotal++;
          const m = String(e.model || '').toLowerCase();
          if (m.includes('haiku')) agentsByModel.haiku++;
          else if (m.includes('sonnet')) agentsByModel.sonnet++;
          else if (m.includes('opus')) agentsByModel.opus++;
          else agentsByModel.other++;
        }
      } catch {}
    }
  } catch {}

  // Format entry
  const startDate = new Date(startTs);
  const endDate = new Date(endTs);
  const dateStr = startDate.toISOString().slice(0, 10);
  const startTime = startDate.toTimeString().slice(0, 5);
  const endTime = endDate.toTimeString().slice(0, 5);

  const lines = [];
  lines.push(`## ${dateStr} ${startTime}–${endTime} (${durationMin} min)`);
  lines.push(`- branch: ${branch}`);
  if (commitsCount > 0) {
    lines.push(`- commits: ${commitsCount} (${commitRange})`);
  } else {
    lines.push('- commits: 0');
  }
  if (agentsTotal > 0) {
    const breakdown = ['haiku', 'sonnet', 'opus', 'other']
      .filter(m => agentsByModel[m] > 0)
      .map(m => `${agentsByModel[m]} ${m}`)
      .join(', ');
    lines.push(`- agents: ${agentsTotal} dispatches (${breakdown})`);
  }
  lines.push(`- exit: ${dirtyCount === 0 ? 'clean' : `${dirtyCount} uncommitted`}`);
  const entry = lines.join('\n') + '\n\n';

  // Append to session-log.md
  const memoryDir = path.join(HOME, '.claude', 'projects', encodeRepoPath(cwd), 'memory');
  const logPath = path.join(memoryDir, 'session-log.md');
  try {
    fs.mkdirSync(memoryDir, { recursive: true });
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '# Session log\n\n');
    }
    fs.appendFileSync(logPath, entry);
  } catch {}

  // Cleanup marker
  try { fs.unlinkSync(markerPath); } catch {}

  process.exit(0);
});
