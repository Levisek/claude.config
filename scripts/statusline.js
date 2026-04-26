#!/usr/bin/env node
// StatusLine: trvalý jednořádkový status pod promptem. Běží při každém redrawu.
// Max target: <50 ms. Žádné dependency, defensive fallbacky.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const theme = require(path.join(os.homedir(), '.claude', 'lib', 'theme.js'));
const { gitInfoLite } = require(path.join(os.homedir(), '.claude', 'lib', 'git-info.js'));
const { projectInfo } = require(path.join(os.homedir(), '.claude', 'lib', 'project-info.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input || '{}'); } catch {}

  const cwd = data?.workspace?.current_dir || data?.cwd || process.cwd();
  const sessionId = data?.session_id || '';
  const modelRaw = data?.model?.display_name || data?.model?.id || '';
  const model = shortModel(modelRaw);
  const config = theme.loadConfig();
  const segmentsConfig = config.statusLine.segments || ['project', 'git', 'tsc', 'context', 'cost'];

  let proj = { name: path.basename(cwd), type: 'none' };
  try { proj = projectInfo(cwd); } catch {}

  let git = { inRepo: false };
  try { git = gitInfoLite(cwd); } catch {}

  const segments = [];

  for (const s of segmentsConfig) {
    try {
      if (s === 'project') segments.push(projectSegment(proj, model));
      else if (s === 'git' && git.inRepo) segments.push(gitSegment(git));
      else if (s === 'tsc' && proj.hasTsconfig) segments.push(tscSegment(sessionId));
      else if (s === 'files') {
        const seg = filesSegment(cwd);
        if (seg) segments.push(seg);
      } else if (s === 'context') {
        const seg = contextSegment(data);
        if (seg) segments.push(seg);
      } else if (s === 'limits') {
        const seg = limitsSegment(data);
        if (seg) segments.push(seg);
      } else if (s === 'cache') {
        const seg = cacheSegment(data);
        if (seg) segments.push(seg);
      } else if (s === 'cost') {
        const seg = costSegment(data);
        if (seg) segments.push(seg);
      } else if (s === 'mcp') {
        const seg = mcpSegment();
        if (seg) segments.push(seg);
      }
    } catch {}
  }

  process.stdout.write(theme.pipe(segments));
});

function shortModel(m) {
  if (!m) return '';
  const s = String(m).toLowerCase();
  if (s.includes('opus')) return 'opus' + versionFrag(s);
  if (s.includes('sonnet')) return 'sonnet' + versionFrag(s);
  if (s.includes('haiku')) return 'haiku' + versionFrag(s);
  return m;
}
function versionFrag(s) {
  const m = s.match(/(\d+[.-]\d+)/);
  return m ? ' ' + m[1].replace('-', '.') : '';
}

function projectSegment(proj, model) {
  const isPlain = theme.activeTheme() === 'plain';
  const diamond = isPlain ? '#' : '◆';
  const head = theme.color(diamond, 'purple') + ' ' + theme.color(proj.name, 'cyan');
  const tail = [];
  if (proj.type && proj.type !== 'none') tail.push(theme.color(proj.type, 'cyan'));
  if (model) tail.push(theme.color(model, 'cyan'));
  return { text: [head, ...tail].join(' · ') };
}

function gitSegment(g) {
  const glyph = theme.glyphs();
  let text = glyph.branch + ' ' + g.branch;
  if (g.dirtyCount > 0) text += ' ' + glyph.diff + g.dirtyCount;
  if (g.ahead > 0) text += ' ' + glyph.up + g.ahead;
  if (g.behind > 0) text += ' ' + glyph.down + g.behind;
  const color = g.behind > 0 ? 'red' : (g.dirtyCount > 0 || g.ahead > 0 ? 'yellow' : 'green');
  return { text, color };
}

function tscSegment(sessionId) {
  const glyph = theme.glyphs();
  if (!sessionId) return { text: 'tsc ' + glyph.info, color: 'gray' };
  const statusFile = path.join(os.homedir(), '.claude', 'session-env', sessionId, 'tsc-status');
  try {
    const raw = fs.readFileSync(statusFile, 'utf8');
    const s = JSON.parse(raw);
    if (s.ok) return { text: 'tsc ' + glyph.check, color: 'green' };
    return { text: 'tsc ' + glyph.cross + ' ' + (s.errors || '?'), color: 'red' };
  } catch {
    return { text: 'tsc —', color: 'gray' };
  }
}

function contextSegment(data) {
  const cw = data?.context_window;
  const pct = typeof cw?.used_percentage === 'number'
    ? cw.used_percentage
    : (typeof data?.context_usage_percent === 'number' ? data.context_usage_percent : null);
  if (typeof pct === 'number') {
    const color = pct > 80 ? 'red' : pct > 60 ? 'yellow' : 'green';
    return { text: `ctx ${Math.round(pct)}%`, color };
  }
  if (data?.exceeds_200k_tokens === true) return { text: 'ctx >200k', color: 'yellow' };
  return null;
}

function costSegment(data) {
  const cost = data?.cost?.total_cost_usd;
  const sessionId = data?.session_id || '_default';

  const cachePath = path.join(os.homedir(), '.claude', 'cache', 'cost-cache.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}

  const prev = typeof cache[sessionId] === 'number' ? cache[sessionId] : 0;
  const display = typeof cost === 'number' ? Math.max(prev, cost) : prev;
  if (display <= 0) return null;

  if (display > prev) {
    cache[sessionId] = display;
    const keys = Object.keys(cache);
    if (keys.length > 20) {
      const trimmed = {};
      keys.slice(-20).forEach(k => { trimmed[k] = cache[k]; });
      cache = trimmed;
    }
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cache));
    } catch {}
  }

  return { text: `$${display.toFixed(2)}`, color: 'magenta' };
}

const SOURCE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php',
  '.swift', '.kt', '.vue', '.svelte',
  '.c', '.cpp', '.cc', '.h', '.hpp',
]);
const SKIP_DIR = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  'target', '__pycache__', '.venv', 'venv', 'out', '.serena',
  '.turbo', 'coverage', '.parcel-cache', '.svelte-kit',
]);
const MAX_FILES = 2000;

function countSourceFiles(root) {
  let count = 0;
  const stack = [root];
  while (stack.length && count < MAX_FILES) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIR.has(e.name)) continue;
        if (e.name.startsWith('.') && dir !== root) continue;
        stack.push(path.join(dir, e.name));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (SOURCE_EXT.has(ext)) {
          count++;
          if (count >= MAX_FILES) return count;
        }
      }
    }
  }
  return count;
}

function limitsSegment(data) {
  const fh = data?.rate_limits?.five_hour;
  if (!fh || typeof fh.used_percentage !== 'number') return null;
  const used = Math.round(fh.used_percentage);

  let pace = '';
  let paceDelta = 0;
  if (typeof fh.resets_at === 'number') {
    const WINDOW_S = 5 * 3600;
    const remaining = fh.resets_at - (Date.now() / 1000);
    const elapsed = WINDOW_S - remaining;
    if (elapsed > 60 && elapsed < WINDOW_S) {
      const elapsedPct = (elapsed / WINDOW_S) * 100;
      paceDelta = Math.round(used - elapsedPct);
      if (Math.abs(paceDelta) >= 1) {
        const g = theme.glyphs();
        const arrow = paceDelta > 0 ? g.up : g.down;
        pace = ` ${arrow}${Math.abs(paceDelta)}%`;
      }
    }
  }

  let color;
  if (used > 80 || paceDelta > 25) color = 'red';
  else if (used > 50 || paceDelta > 10) color = 'yellow';
  else color = 'green';

  return { text: `5h ${used}%${pace}`, color };
}

function cacheSegment(data) {
  const cu = data?.context_window?.current_usage;
  if (!cu) return null;
  const cacheRead = cu.cache_read_input_tokens || 0;
  const cacheCreate = cu.cache_creation_input_tokens || 0;
  const input = cu.input_tokens || 0;
  const total = cacheRead + cacheCreate + input;
  if (total < 100) return null;
  const pct = Math.round((cacheRead / total) * 100);
  const color = pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'gray';
  return { text: `cache ${pct}%`, color };
}

function mcpSegment() {
  const cachePath = path.join(os.homedir(), '.claude', 'cache', 'mcp-status.json');
  const TTL_MS = 30 * 1000;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}

  let serenaUp = cache.serena;
  if (!cache.t || (Date.now() - cache.t) >= TTL_MS) {
    try {
      const r = spawnSync('powershell', [
        '-NoProfile', '-Command',
        "(Get-CimInstance Win32_Process | Where-Object { $_.Name -in 'serena.exe','python.exe' -and $_.CommandLine -like '*start-mcp-server*' } | Measure-Object).Count"
      ], { encoding: 'utf8', timeout: 4000, windowsHide: true });
      serenaUp = parseInt(String(r.stdout).trim(), 10) > 0;
    } catch { serenaUp = false; }
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify({ t: Date.now(), serena: serenaUp }));
    } catch {}
  }

  if (!serenaUp) return null;
  return { text: 'serena', color: 'brightGreen' };
}

function filesSegment(cwd) {
  if (!cwd) return null;
  const cachePath = path.join(os.homedir(), '.claude', 'cache', 'file-counts.json');
  const TTL_MS = 5 * 60 * 1000;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}

  const entry = cache[cwd];
  let count;
  if (entry && typeof entry.n === 'number' && (Date.now() - entry.t) < TTL_MS) {
    count = entry.n;
  } else {
    count = countSourceFiles(cwd);
    cache[cwd] = { n: count, t: Date.now() };
    const sorted = Object.entries(cache).sort((a, b) => b[1].t - a[1].t).slice(0, 50);
    cache = Object.fromEntries(sorted);
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cache));
    } catch {}
  }

  if (count === 0) return null;
  const cap = count >= MAX_FILES ? `${MAX_FILES}+` : String(count);
  const color = count < 20 ? 'gray' : count < 100 ? 'cyan' : 'green';
  return { text: `files ${cap}`, color };
}
