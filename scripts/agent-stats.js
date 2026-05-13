#!/usr/bin/env node
// Agreguje ~/.claude/logs/agent-decisions.jsonl — vypíše distribuci dispatchů
// per model a top triggery. Slouží k vytříbení routing rubriky skillu
// token-aware (vidíš kolikrát volíš opus zbytečně, atd.).
//
// Backward-compat: čte i staré effort-decisions.jsonl pokud nový soubor chybí.

const fs = require('fs');
const path = require('path');
const os = require('os');

function aggregate(lines) {
  const agentCounts = {};
  const triggerCounts = {};
  const mainCounts = {};
  let totalTurns = 0;

  for (const entry of lines) {
    if (!entry || typeof entry !== 'object') continue;
    totalTurns++;
    if (entry.main) {
      const m = String(entry.main).toLowerCase();
      mainCounts[m] = (mainCounts[m] || 0) + 1;
    }
    if (Array.isArray(entry.agents)) {
      for (const a of entry.agents) {
        if (!a || !a.model) continue;
        const m = String(a.model).toLowerCase();
        agentCounts[m] = (agentCounts[m] || 0) + (a.count || 1);
      }
    }
    if (entry.trigger) {
      triggerCounts[entry.trigger] = (triggerCounts[entry.trigger] || 0) + 1;
    }
  }

  return { agentCounts, triggerCounts, mainCounts, totalTurns };
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
  lines.push(`Agent decisions: ${agg.totalTurns} turnů celkem`);
  lines.push('');

  lines.push('Subagent dispatches per model:');
  const agentEntries = Object.entries(agg.agentCounts).sort((a, b) => b[1] - a[1]);
  if (agentEntries.length === 0) {
    lines.push('  (žádné — buď nepouštíš subagenty, nebo log je prázdný)');
  } else {
    const totalAgents = agentEntries.reduce((s, [, x]) => s + x, 0);
    const maxA = Math.max(...agentEntries.map(([, n]) => n), 1);
    for (const [model, n] of agentEntries) {
      const pct = Math.round((n / totalAgents) * 100);
      lines.push(`  ${model.padEnd(8)} ${bar(n, maxA)} ${n}× (${pct}%)`);
    }
  }
  lines.push('');

  lines.push('Top triggery:');
  const trigEntries = Object.entries(agg.triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (trigEntries.length === 0) lines.push('  (žádné)');
  else for (const [t, n] of trigEntries) lines.push(`  ${t.padEnd(24)} ${n}`);

  return lines.join('\n');
}

if (require.main === module) {
  const home = os.homedir();
  const newPath = path.join(home, '.claude', 'logs', 'agent-decisions.jsonl');
  const oldPath = path.join(home, '.claude', 'logs', 'effort-decisions.jsonl');
  const logPath = fs.existsSync(newPath) ? newPath : oldPath;
  const lines = readLog(logPath);
  console.log(report(aggregate(lines)));
}

module.exports = { aggregate, report, readLog };
