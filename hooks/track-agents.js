#!/usr/bin/env node
// PreToolUse + PostToolUse pro Agent matcher.
//
// PreToolUse: dvě responsibility v jednom volání
//   1. Pokud Agent tool call nemá explicitní `model`, doplň ho podle role
//      (subagent_type + description) → updatedInput
//   2. Zaznamenej dispatch do ~/.claude/cache/agents-running.json
//      (statusline z toho rendruje "live: N×model")
//
// PostToolUse: odstraní záznam.
//
// Bez závislostí. Tichá chyba — nesmí blokovat tool call.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { inferModel } = require(path.join(os.homedir(), '.claude', 'lib', 'model-resolver.js'));

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

  if (!sessionId) {
    if (event === 'PreToolUse') emitDefer();
    process.exit(0);
  }

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
    const inferredModel = inferModel(ti);
    const model = (ti.model || inferredModel || 'sonnet').toLowerCase();
    const role = ti.subagent_type || ti.description || 'task';

    // Zaznamenat dispatch (s effektivním modelem)
    list.push({
      id: toolUseId || `t${now}${Math.floor(Math.random() * 1000)}`,
      model,
      role: String(role).slice(0, 30),
      startedAt: now,
    });
    all[sessionId] = list;
    writeCache(all);

    // Pokud byl model chybějící, doplnit přes updatedInput
    if (!ti.model && inferredModel) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          updatedInput: { ...ti, model: inferredModel },
        },
      }));
    } else {
      emitDefer();
    }
    process.exit(0);
  } else if (event === 'PostToolUse') {
    if (toolUseId) {
      all[sessionId] = list.filter(a => a.id !== toolUseId);
    } else {
      all[sessionId] = list.slice(1);
    }
    if (all[sessionId].length === 0) delete all[sessionId];
    writeCache(all);
    process.exit(0);
  }

  process.exit(0);
});

function emitDefer() {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'defer',
    },
  }));
}

function writeCache(all) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(all));
  } catch {}
}

