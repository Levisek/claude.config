#!/usr/bin/env node
// Agreguje ~/.claude/logs/effort-decisions.jsonl — vypíše distribuci effortu,
// počty agentních dispatchů per model, a top triggery. Slouží k vytříbení
// rubriky skillu token-aware.

const fs = require('fs');
const path = require('path');
const os = require('os');

function aggregate(lines) {
  const effortCounts = { 60: 0, 75: 0, 99: 0 };
  const agentCounts = {};
  const triggerCounts = {};
  let totalTurns = 0;

  for (const entry of lines) {
    if (!entry || typeof entry !== 'object') continue;
    totalTurns++;
    if (entry.effort != null && effortCounts[entry.effort] !== undefined) {
      effortCounts[entry.effort]++;
    }
    if (Array.isArray(entry.agents)) {
      for (const a of entry.agents) {
        if (!a || !a.model) continue;
        agentCounts[a.model] = (agentCounts[a.model] || 0) + (a.count || 1);
      }
    }
    if (entry.trigger) {
      triggerCounts[entry.trigger] = (triggerCounts[entry.trigger] || 0) + 1;
    }
  }

  return { effortCounts, agentCounts, triggerCounts, totalTurns };
}

function bar(n, max, width = 24) {
  if (max === 0) return '';
  const filled = Math.round((n / max) * width);
  return '█'.repeat(filled) + '·'.repeat(width - filled);
}

function readLog(logPath) {
  if (!fs.existsSync(logPath)) return [];
  const raw = fs.readFileSync(logPath, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return out;
}

function report(agg) {
  const lines = [];
  lines.push(`Token-aware decisions: ${agg.totalTurns} turnů celkem`);
  lines.push('');
  lines.push('Effort distribuce:');
  const maxE = Math.max(...Object.values(agg.effortCounts), 1);
  for (const level of [60, 75, 99]) {
    const c = agg.effortCounts[level];
    const pct = agg.totalTurns ? Math.round((c / agg.totalTurns) * 100) : 0;
    lines.push(`  IQ:${level}  ${bar(c, maxE)} ${c} (${pct}%)`);
  }
  lines.push('');
  lines.push('Subagent dispatches per model:');
  const agentEntries = Object.entries(agg.agentCounts).sort((a, b) => b[1] - a[1]);
  if (agentEntries.length === 0) lines.push('  (žádné)');
  else for (const [model, n] of agentEntries) lines.push(`  ${model.padEnd(8)} ${n}×`);
  lines.push('');
  lines.push('Top triggery:');
  const trigEntries = Object.entries(agg.triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (trigEntries.length === 0) lines.push('  (žádné)');
  else for (const [t, n] of trigEntries) lines.push(`  ${t.padEnd(24)} ${n}`);
  return lines.join('\n');
}

if (require.main === module) {
  const logPath = path.join(os.homedir(), '.claude', 'logs', 'effort-decisions.jsonl');
  const lines = readLog(logPath);
  console.log(report(aggregate(lines)));
}

module.exports = { aggregate, report, readLog };
