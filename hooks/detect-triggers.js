#!/usr/bin/env node
// UserPromptSubmit hook — auto-detect dvou vrstev signálů:
//   1. token-aware (plánovaný dispatch subagentů) → reminder s routing tabulkou
//   2. time-aware (planning / estimate fáze) → historical signals z cache/duration-stats.json
//      + memory/surprises-<repo>.md hint
//
// Tichá chyba — nesmí blokovat user prompt.

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const DURATION_STATS_PATH = path.join(HOME, '.claude', 'cache', 'duration-stats.json');
const MEMORY_DIR = path.join(HOME, '.claude', 'memory');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const prompt = String(data?.prompt || '').toLowerCase();
  if (!prompt) process.exit(0);

  const tokenTriggers = [
    'rozdělej', 'rozděl to', 'naplánuj', 'naplán', 'agenti', 'agent ', 'agents',
    'subagent', 'sdd', 'subagent-driven', 'parallel', 'paralelně',
    'použij haiku', 'use haiku', 'cheap agent', 'levné agent',
    ' plán', 'navrhni', 'navrhnout', 'design ', 'spec ', 'specifikuj',
    'roadmap', 'architecture', 'architekturu',
    'refactor', 'přepiš', 'rewrite', 'multi-soubor', 'multi-file',
    'token-aware', 'jaký model', 'what model', 'which agents',
  ];

  const timeTriggers = [
    'jak dlouho', 'kolik to zabere', 'kolik zabere', 'odhad', 'odhadni',
    'naplánuj', 'rozplánuj', 'roadmap', 'plan this', 'break down',
    'how long', 'estimate', 'estimation',
  ];

  const tokenMatch = firstMatch(prompt, tokenTriggers);
  const timeMatch = firstMatch(prompt, timeTriggers);

  if (!tokenMatch && !timeMatch) process.exit(0);

  const sections = [];

  if (tokenMatch) {
    sections.push(`[auto-trigger: "${tokenMatch}"] User message naznačuje plánovaný dispatch subagentů nebo netriviální plán. Před dispatchem:

1. **Invokuj skill token-aware** (jednou za turn, ne opakovaně) — vyhodnotí strategii a zapíše snapshot pro status panel.
2. **Pre-bind subagenty** (definice v \`~/.claude/agents/<name>.md\`):
   - \`implementer-mech\` (haiku) — 1-2 file mechanical change
   - \`implementer-multi\` (sonnet) — multi-file / integration
   - \`spec-reviewer\` (haiku) — spec ↔ code check
   - \`code-reviewer\` (sonnet) — quality, smells, bugs
   - \`dead-code-scanner\` (haiku) — unused exports/imports
   - \`architect\` (opus) — design decisions, ADR
3. **Dispatchuj jménem**: \`subagent_type: "<name>"\` v Agent tool callu. Model je v frontmatteru — explicit \`model:\` parametr není potřeba, ale stále override-uje pokud ho předáš.
4. Pro 3+ tasků: SDD parallel batch mode je DEFAULT (viz CLAUDE.md).

Pokud user signál byl false-positive (např. mluví o agentech jako konceptu, ne o dispatchi), ignoruj.`);
  }

  if (timeMatch) {
    const cwd = data?.cwd || data?.workspace?.current_dir || process.cwd();
    const repo = resolveRepoSafely(cwd);
    const timeBlock = buildTimeBlock(repo);
    if (timeBlock) sections.push(timeBlock);
  }

  if (sections.length === 0) process.exit(0);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: sections.join('\n\n'),
    },
  }));
  process.exit(0);
});

function firstMatch(prompt, triggers) {
  for (const t of triggers) {
    if (prompt.includes(t)) return t;
  }
  return null;
}

function resolveRepoSafely(cwd) {
  try {
    const { resolveRepoName } = require(path.join(HOME, '.claude', 'lib', 'repo-name.js'));
    return resolveRepoName(cwd);
  } catch {
    return null;
  }
}

function buildTimeBlock(repo) {
  let stats = null;
  try {
    stats = JSON.parse(fs.readFileSync(DURATION_STATS_PATH, 'utf8'));
  } catch {
    return null; // žádná data → falešná čísla horší než žádná
  }

  const repoStats = repo && stats?.stats?.[repo];
  const lines = [];

  if (repoStats) {
    const entries = Object.entries(repoStats)
      .map(([sub, s]) => ({ sub, ...s }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 3);

    if (entries.length > 0) {
      lines.push(`[Historical signals for "${repo}" — last 90 days]`);
      for (const e of entries) {
        const pct = Math.round((e.success_rate || 0) * 100);
        const iter = e.typical_iterations != null ? `, iter≈${e.typical_iterations}` : '';
        lines.push(`- ${e.sub}: median ${e.median_min}min, P90 ${e.p90_min}min (n=${e.samples}, ${pct}% success${iter})`);
      }
      lines.push('Note: P90 is the realistic upper bound; default estimates tend to land near P50.');
    }
  }

  // Past surprises — per-repo memory soubor
  if (repo) {
    const surprisesPath = path.join(MEMORY_DIR, `surprises-${repo}.md`);
    try {
      const raw = fs.readFileSync(surprisesPath, 'utf8');
      const bullets = raw.split('\n').filter(l => /^\s*-\s/.test(l)).slice(-5);
      if (bullets.length > 0) {
        if (lines.length > 0) lines.push('');
        lines.push(`[Past surprises in "${repo}"]`);
        lines.push(...bullets.map(b => b.trim()));
      }
    } catch {}
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
