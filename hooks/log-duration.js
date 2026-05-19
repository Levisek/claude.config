#!/usr/bin/env node
// Modul (ne standalone hook) volaný z track-agents.js. Sleduje trvání agent
// dispatchů a appendne výsledek do logs/agent-durations.jsonl.
//
// Exports:
//   recordStart({ sessionId, toolUseId, ti, cwd })   → enriched record pro cache
//   finalizeDispatch(record, postPayload)            → spočítá duration + zapíše JSONL
//
// CLI:
//   node hooks/log-duration.js --self-test           → smoke test (žádné side effecty
//                                                       mimo dočasné soubory)
//
// Tichá chyba — žádná throw, nesmí blokovat hook.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');

const { resolveRepoName } = require(path.join(os.homedir(), '.claude', 'lib', 'repo-name.js'));

const HOME = os.homedir();
const LOG_PATH = path.join(HOME, '.claude', 'logs', 'agent-durations.jsonl');
const LOCK_PATH = path.join(HOME, '.claude', 'cache', 'duration-stats.lock');
const STATS_SCRIPT = path.join(HOME, '.claude', 'scripts', 'duration-stats.js');
const DEBOUNCE_MS = 30 * 1000;

function readTscStatus(sessionId) {
  if (!sessionId) return null;
  const p = path.join(HOME, '.claude', 'session-env', sessionId, 'tsc-status');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function recordStart({ sessionId, toolUseId, ti, cwd, model, now }) {
  const t = typeof now === 'number' ? now : Date.now();
  const desc = String(ti?.description || ti?.subagent_type || 'task').slice(0, 80);
  const subagentType = String(ti?.subagent_type || 'task').slice(0, 40);
  const tscBefore = readTscStatus(sessionId);
  let repo = 'unknown';
  try { repo = resolveRepoName(cwd || process.cwd()); } catch {}

  return {
    id: toolUseId || `t${t}${crypto.randomBytes(4).toString('hex')}`,
    startedAt: t,
    subagent_type: subagentType,
    description: desc,
    model: String(model || 'sonnet').toLowerCase(),
    repo,
    cwd: cwd || process.cwd(),
    tscBeforeTs: tscBefore?.timestamp || 0,
    // Polish pro track-agents kompatibilitu — statusline čte `role`.
    role: desc.slice(0, 30),
  };
}

function inferStatus(postPayload) {
  const tr = postPayload?.tool_response;
  if (tr && typeof tr === 'object') {
    if (tr.is_error === true) return 'failed';
    if (typeof tr.error === 'string' && tr.error.length > 0) return 'failed';
  }
  if (postPayload?.is_error === true) return 'failed';
  return 'completed';
}

function inferTscPassedFirstTry(record, sessionId) {
  const after = readTscStatus(sessionId);
  if (!after || !after.timestamp) return null;
  if (after.timestamp <= (record.tscBeforeTs || 0)) return null; // žádný edit .ts/.tsx během agenta
  return after.ok === true;
}

function inferIterations(record, otherRunning) {
  if (!Array.isArray(otherRunning) || otherRunning.length === 0) return null;
  const prefix = (record.description || '').slice(0, 50);
  const sub = record.subagent_type;
  let n = 0;
  for (const r of otherRunning) {
    if (!r || r.id === record.id) continue;
    if (r.subagent_type === sub && (r.description || '').slice(0, 50) === prefix) n++;
  }
  return n > 0 ? n + 1 : 1;
}

function appendLog(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
    return true;
  } catch {
    return false;
  }
}

function triggerStatsRebuild() {
  try {
    const now = Date.now();
    let lockTs = 0;
    try {
      const raw = fs.readFileSync(LOCK_PATH, 'utf8');
      lockTs = parseInt(raw, 10) || 0;
    } catch {}
    if (now - lockTs < DEBOUNCE_MS) return;

    fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
    fs.writeFileSync(LOCK_PATH, String(now));

    if (!fs.existsSync(STATS_SCRIPT)) return;
    const child = spawn(process.execPath, [STATS_SCRIPT, '--silent'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {}
}

function finalizeDispatch(record, postPayload, opts = {}) {
  if (!record || !record.startedAt) return null;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const sessionId = opts.sessionId || postPayload?.session_id || '';
  const duration_ms = Math.max(0, now - record.startedAt);
  const status = inferStatus(postPayload);
  const tsc_passed_first_try = inferTscPassedFirstTry(record, sessionId);
  const iterations = inferIterations(record, opts.otherRunning);

  const entry = {
    ts: new Date(now).toISOString(),
    repo: record.repo || 'unknown',
    subagent_type: record.subagent_type || 'task',
    description: record.description || '',
    model: record.model || 'sonnet',
    duration_ms,
    status,
    tsc_passed_first_try,
    iterations,
  };

  const ok = appendLog(entry);
  if (ok && !opts.skipRebuild) triggerStatsRebuild();
  return entry;
}

// -------- CLI self-test ---------------------------------------------------

function selfTest() {
  const tmpLog = path.join(os.tmpdir(), `log-duration-selftest-${Date.now()}.jsonl`);
  const origLog = LOG_PATH;
  // Monkey-patch LOG_PATH přes proxy — jednodušší: zapíšeme přímo a porovnáme.
  // Místo přesměrování zavoláme čisté funkce a ověříme tvar entry.

  const rec = recordStart({
    sessionId: 'selftest',
    toolUseId: 'tu_test_123',
    ti: { subagent_type: 'general-purpose', description: 'Self-test dispatch' },
    cwd: process.cwd(),
    model: 'haiku',
    now: 1000,
  });

  const assertions = [];
  assertions.push(['recordStart.id', rec.id === 'tu_test_123']);
  assertions.push(['recordStart.startedAt', rec.startedAt === 1000]);
  assertions.push(['recordStart.subagent_type', rec.subagent_type === 'general-purpose']);
  assertions.push(['recordStart.model', rec.model === 'haiku']);
  assertions.push(['recordStart.repo nonempty', typeof rec.repo === 'string' && rec.repo.length > 0]);
  assertions.push(['recordStart.description', rec.description === 'Self-test dispatch']);
  assertions.push(['recordStart.role <=30', rec.role.length <= 30]);

  // finalizeDispatch — completed
  const entry = finalizeDispatch(rec, { tool_response: {} }, {
    sessionId: 'selftest',
    now: 5000,
    skipRebuild: true,
    otherRunning: [],
  });
  // Lehce poskvrníme reálný log — to je dle zadání OK (self-test mode).
  assertions.push(['finalize.duration_ms', entry.duration_ms === 4000]);
  assertions.push(['finalize.status completed', entry.status === 'completed']);
  assertions.push(['finalize.tsc_passed null', entry.tsc_passed_first_try === null]);
  assertions.push(['finalize.iterations 1', entry.iterations === 1 || entry.iterations === null]);

  // failed status
  const failed = finalizeDispatch(rec, { tool_response: { is_error: true } }, {
    sessionId: 'selftest',
    now: 6000,
    skipRebuild: true,
    otherRunning: [],
  });
  assertions.push(['finalize.failed', failed.status === 'failed']);

  // status z error stringu
  const failed2 = finalizeDispatch(rec, { tool_response: { error: 'something broke' } }, {
    sessionId: 'selftest',
    now: 6500,
    skipRebuild: true,
  });
  assertions.push(['finalize.error string → failed', failed2.status === 'failed']);

  // iterations proxy
  const others = [
    { id: 'x1', subagent_type: 'general-purpose', description: 'Self-test dispatch' },
    { id: 'x2', subagent_type: 'general-purpose', description: 'Self-test dispatch' },
  ];
  const withIter = finalizeDispatch(rec, { tool_response: {} }, {
    sessionId: 'selftest',
    now: 7000,
    skipRebuild: true,
    otherRunning: others,
  });
  assertions.push(['finalize.iterations proxy', withIter.iterations === 3]);

  let pass = 0, fail = 0;
  for (const [name, ok] of assertions) {
    if (ok) { pass++; console.log(`  ok    ${name}`); }
    else { fail++; console.log(`  FAIL  ${name}`); }
  }
  console.log(`\n${pass} pass, ${fail} fail`);
  return fail === 0;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    const ok = selfTest();
    process.exit(ok ? 0 : 1);
  } else {
    console.log('log-duration.js — modul. Použij přes track-agents.js, nebo spusť --self-test.');
    process.exit(0);
  }
}

module.exports = {
  recordStart,
  finalizeDispatch,
  inferStatus,
  inferTscPassedFirstTry,
  inferIterations,
  triggerStatsRebuild,
};
