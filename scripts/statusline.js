#!/usr/bin/env node
// StatusLine: trvalý jednořádkový status pod promptem. Běží při každém redrawu.
// Max target: <50 ms. Žádné dependency, defensive fallbacky.

const fs = require('fs');
const path = require('path');
const os = require('os');

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
      else if (s === 'context') {
        const seg = contextSegment(data);
        if (seg) segments.push(seg);
      } else if (s === 'cost') {
        const seg = costSegment(data);
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
  const g = theme.glyphs();
  const parts = [proj.name];
  if (proj.type && proj.type !== 'none') parts.push(proj.type);
  if (model) parts.push(model);
  return { text: parts.join(' · '), color: 'cyan' };
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
  const pct = data?.context_usage_percent ?? data?.exceeds_200k_tokens;
  if (typeof pct === 'number') {
    const color = pct > 80 ? 'red' : pct > 60 ? 'yellow' : 'green';
    return { text: `ctx ${Math.round(pct)}%`, color };
  }
  if (pct === true) return { text: 'ctx >200k', color: 'yellow' };
  return null;
}

function costSegment(data) {
  const cost = data?.cost?.total_cost_usd;
  if (typeof cost !== 'number') return null;
  return { text: `$${cost.toFixed(2)}`, color: 'magenta' };
}
