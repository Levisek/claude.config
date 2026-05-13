#!/usr/bin/env node
// PreToolUse + PostToolUse pro Agent matcher.
// Spravuje ~/.claude/cache/agents-running.json — seznam aktuálně běžících
// subagentů per session. Statusline z toho rendruje "live: 1×sonnet, 2×haiku".
//
// Bez závislostí. Tichá chyba — nesmí blokovat tool call.

const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_PATH = path.join(os.homedir(), '.claude', 'cache', 'agents-running.json');
const STALE_MS = 30 * 60 * 1000;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const event = data?.hook_event_name || '';
  const sessionId = data?.session_id || '';
  const toolUseId = data?.tool_use_id || data?.tool_input?.tool_use_id || '';
  if (!sessionId) process.exit(0);

  let all = {};
  try { all = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch {}
  if (!all || typeof all !== 'object') all = {};

  // Cleanup stale napříč sessions
  const now = Date.now();
  for (const sid of Object.keys(all)) {
    if (!Array.isArray(all[sid])) { delete all[sid]; continue; }
    all[sid] = all[sid].filter(a => a && (now - (a.startedAt || 0)) < STALE_MS);
    if (all[sid].length === 0) delete all[sid];
  }

  const list = all[sessionId] || [];

  if (event === 'PreToolUse') {
    const ti = data?.tool_input || {};
    const model = (ti.model || inferModel(ti.subagent_type) || 'opus').toLowerCase();
    const role = ti.subagent_type || ti.description || 'task';
    list.push({
      id: toolUseId || `t${now}${Math.floor(Math.random() * 1000)}`,
      model,
      role: String(role).slice(0, 30),
      startedAt: now,
    });
    all[sessionId] = list;
  } else if (event === 'PostToolUse') {
    if (toolUseId) {
      all[sessionId] = list.filter(a => a.id !== toolUseId);
    } else {
      // Fallback: odstraň nejstarší
      all[sessionId] = list.slice(1);
    }
    if (all[sessionId].length === 0) delete all[sessionId];
  }

  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(all));
  } catch {}

  process.exit(0);
});

function inferModel(subagentType) {
  if (!subagentType) return null;
  const s = String(subagentType).toLowerCase();
  // Známé typy z Agent tool description
  if (s === 'explore' || s === 'general-purpose') return 'sonnet';
  if (s === 'plan') return 'opus';
  if (s === 'statusline-setup') return 'haiku';
  return null;
}
