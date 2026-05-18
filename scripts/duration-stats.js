#!/usr/bin/env node
// Agreguje ~/.claude/logs/agent-durations.jsonl per (repo × subagent_type).
//
// Filtr: jen poslední 90 dní, min. 3 vzorky per kombinace (jinak je číslo šum).
//
// Výstup:
//   - cache/duration-stats.json (vždy přepsán)
//   - stdout: human-readable report (suprimovaný v --silent módu)
//
// Spouští se on-demand i přes log-duration.js (spawn s 30s debounce).

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const LOG_PATH = path.join(HOME, '.claude', 'logs', 'agent-durations.jsonl');
const CACHE_PATH = path.join(HOME, '.claude', 'cache', 'duration-stats.json');

const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_SAMPLES = 3;

function readLog(logPath = LOG_PATH) {
  if (!fs.existsSync(logPath)) return [];
  const raw = fs.readFileSync(logPath, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return out;
}

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

function median(sortedAsc) { return percentile(sortedAsc, 50); }

function aggregate(entries, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const cutoff = now - WINDOW_MS;
  const minSamples = typeof opts.minSamples === 'number' ? opts.minSamples : MIN_SAMPLES;

  // groups[repo][subagent_type] = { durations: [...], successes: N, total: N, iterations: [...] }
  const groups = {};

  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const ts = Date.parse(e.ts || '');
    if (!ts || ts < cutoff) continue;
    if (typeof e.duration_ms !== 'number' || e.duration_ms < 0) continue;

    const repo = e.repo || 'unknown';
    const sub = e.subagent_type || 'task';

    if (!groups[repo]) groups[repo] = {};
    if (!groups[repo][sub]) groups[repo][sub] = { durations: [], successes: 0, total: 0, iterations: [] };
    const g = groups[repo][sub];
    g.durations.push(e.duration_ms);
    g.total++;
    if (e.status === 'completed') g.successes++;
    if (typeof e.iterations === 'number') g.iterations.push(e.iterations);
  }

  const stats = {};
  for (const repo of Object.keys(groups)) {
    for (const sub of Object.keys(groups[repo])) {
      const g = groups[repo][sub];
      if (g.durations.length < minSamples) continue;

      const sortedMs = [...g.durations].sort((a, b) => a - b);
      const medMs = median(sortedMs);
      const p90Ms = percentile(sortedMs, 90);

      let typicalIterations = null;
      if (g.iterations.length >= minSamples) {
        const sortedIt = [...g.iterations].sort((a, b) => a - b);
        typicalIterations = Math.round(median(sortedIt));
      }

      if (!stats[repo]) stats[repo] = {};
      stats[repo][sub] = {
        median_min: Math.round((medMs / 60000) * 10) / 10,
        p90_min: Math.round((p90Ms / 60000) * 10) / 10,
        success_rate: g.total === 0 ? 0 : Math.round((g.successes / g.total) * 100) / 100,
        samples: g.total,
        typical_iterations: typicalIterations,
      };
    }
  }

  return { updated_at: new Date(now).toISOString(), stats };
}

function writeCache(payload, cachePath = CACHE_PATH) {
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2));
    return true;
  } catch {
    return false;
  }
}

function report(payload) {
  const lines = [];
  const repos = Object.keys(payload.stats || {});
  lines.push(`Duration stats — updated ${payload.updated_at}`);
  lines.push('');
  if (repos.length === 0) {
    lines.push('  (zatím nic — buď nejsou data, nebo žádná kombinace nemá ≥3 vzorky)');
    return lines.join('\n');
  }
  for (const repo of repos.sort()) {
    lines.push(`▸ ${repo}`);
    const subs = payload.stats[repo];
    for (const sub of Object.keys(subs).sort()) {
      const s = subs[sub];
      const iter = s.typical_iterations != null ? `, iter≈${s.typical_iterations}` : '';
      lines.push(`    ${sub.padEnd(24)} median ${String(s.median_min).padStart(5)}min · P90 ${String(s.p90_min).padStart(5)}min · ${Math.round(s.success_rate * 100)}% ok · n=${s.samples}${iter}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const silent = args.includes('--silent');

  const entries = readLog();
  const payload = aggregate(entries);
  writeCache(payload);
  if (!silent) console.log(report(payload));
}

module.exports = { readLog, aggregate, writeCache, report, percentile, median };
