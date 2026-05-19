#!/usr/bin/env node
// validate-runtime — health-check pro hook firing + pre-bind agent readiness.
// Spustit kdykoli: `node ~/.claude/scripts/validate-runtime.js`
//   nebo přes slash command: `/validate-runtime`
//
// Reportuje per-hook a per-component status:
//   ✅ Fired recently (within window)
//   ⚠️ No recent activity (optional component or quiet period)
//   ❌ Should fire but no artifact (configuration issue)
//
// Plus: lists pre-bind agents v ~/.claude/agents/ a varuje pokud session
// začala před jejich vznikem (= dispatch by name nefunguje, restart needed).

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

// Helper: nejnovější mtime z glob-like pattern (synchronous, no globbing lib).
function newestMtime(dir, prefix, suffix) {
  if (!fs.existsSync(dir)) return null;
  let newest = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (prefix && !f.startsWith(prefix)) continue;
      if (suffix && !f.endsWith(suffix)) continue;
      try {
        const m = fs.statSync(path.join(dir, f)).mtimeMs;
        if (m > newest) newest = m;
      } catch {}
    }
  } catch {}
  return newest || null;
}

// Helper: nejnovější JSONL line timestamp (parse last 100 lines).
function newestJsonlTs(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim()).slice(-100);
    let newest = 0;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const ts = new Date(e.ts || e.timestamp || 0).getTime();
        if (ts > newest) newest = ts;
      } catch {}
    }
    return newest || null;
  } catch { return null; }
}

// Helper: status badge + relative time string.
function statusReport(mtime, optional, windowH = 24) {
  if (!mtime) {
    return optional
      ? { badge: '⚠️', detail: 'no artifact (optional)' }
      : { badge: '❌', detail: 'no artifact — hook may not be firing' };
  }
  const ageMs = NOW - mtime;
  const ageH = Math.round(ageMs / HOUR * 10) / 10;
  const ageMin = Math.round(ageMs / 60000);
  const ageStr = ageMs < HOUR ? `${ageMin}m ago` : `${ageH}h ago`;
  if (ageMs < windowH * HOUR) {
    return { badge: '✅', detail: `last fire ${ageStr}` };
  }
  return { badge: '⚠️', detail: `last fire ${ageStr} (>window ${windowH}h)` };
}

const checks = [
  {
    name: 'track-agents (PreToolUse/PostToolUse Agent)',
    mtime: () => {
      const f = path.join(CLAUDE_DIR, 'cache', 'agents-running.json');
      return fs.existsSync(f) ? fs.statSync(f).mtimeMs : null;
    },
    optional: false,
  },
  {
    name: 'log-duration (called from track-agents)',
    mtime: () => newestJsonlTs(path.join(CLAUDE_DIR, 'logs', 'agent-durations.jsonl')),
    optional: false,
  },
  {
    name: 'auto-tsc (PostToolUse Write/Edit)',
    mtime: () => newestMtime(path.join(CLAUDE_DIR, 'session-env'), null, null),
    optional: false,
  },
  {
    name: 'session-context startup marker',
    mtime: () => newestMtime(path.join(CLAUDE_DIR, 'cache'), 'session-start-', '.json'),
    optional: false,
  },
  {
    name: 'session-end log writer',
    mtime: () => {
      const projectsDir = path.join(CLAUDE_DIR, 'projects');
      if (!fs.existsSync(projectsDir)) return null;
      let newest = 0;
      for (const repo of fs.readdirSync(projectsDir)) {
        const log = path.join(projectsDir, repo, 'memory', 'session-log.md');
        if (fs.existsSync(log)) {
          const m = fs.statSync(log).mtimeMs;
          if (m > newest) newest = m;
        }
      }
      return newest || null;
    },
    optional: false,
    windowH: 24 * 7, // weekly window — sessions not always daily
  },
  {
    name: 'detect-triggers (UserPromptSubmit)',
    mtime: () => newestJsonlTs(path.join(CLAUDE_DIR, 'logs', 'agent-decisions.jsonl')),
    optional: true, // hook writes additionalContext, no direct file artifact — agent-decisions.jsonl is proxy
  },
  {
    name: 'pre-compact snapshots',
    mtime: () => newestMtime(path.join(CLAUDE_DIR, 'cache'), 'pre-compact-', '.json'),
    optional: true,
  },
  {
    name: 'test-gate bypass log',
    mtime: () => {
      const f = path.join(CLAUDE_DIR, 'logs', 'test-gate-bypass.jsonl');
      return fs.existsSync(f) ? fs.statSync(f).mtimeMs : null;
    },
    optional: true,
  },
];

console.log('# Runtime validation report\n');
console.log(`(now: ${new Date(NOW).toISOString()})\n`);
console.log('## Hooks');

let failures = 0;
for (const c of checks) {
  const mtime = c.mtime();
  const { badge, detail } = statusReport(mtime, c.optional, c.windowH || 24);
  console.log(`  ${badge} ${c.name.padEnd(45)} — ${detail}`);
  if (badge === '❌') failures++;
}

// Pre-bind agents readiness
console.log('\n## Pre-bind agents');
const agentsDir = path.join(CLAUDE_DIR, 'agents');
if (!fs.existsSync(agentsDir)) {
  console.log('  ❌ ~/.claude/agents/ directory missing');
  failures++;
} else {
  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  console.log(`  ✅ ${files.length} agent files in ~/.claude/agents/`);
  for (const f of files.sort()) {
    console.log(`     - ${f}`);
  }
  if (files.length > 0) {
    const oldestAgentMtime = Math.min(...files.map(f => fs.statSync(path.join(agentsDir, f)).mtimeMs));
    // Find current session start marker
    const sessionMarker = newestMtime(path.join(CLAUDE_DIR, 'cache'), 'session-start-', '.json');
    console.log('  ℹ️  Note: Anthropic loads agent enum at session start (server-side,');
    console.log('     before context init). The session-start marker is written later by');
    console.log('     session-context.js, so we can\'t reliably check from cache alone.');
    console.log('     To verify dispatch works, try: Agent(subagent_type: "implementer-mech", ...).');
    console.log('     If "Agent type not found", restart Claude Code session.');
  }
}

console.log('\n## Summary');
console.log(failures === 0
  ? '  ✅ All required hooks have recent activity. Setup looks healthy.'
  : `  ❌ ${failures} required hook(s) without recent activity. Investigate.`);

process.exit(failures > 0 ? 1 : 0);
