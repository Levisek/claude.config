#!/usr/bin/env node
// PostToolUse (Write/Edit na *.ts/*.tsx): rychlý tsc check.
// Nezdržuje — běží s timeoutem 20 s a reportuje jen chyby v právě editovaném souboru.
// Navíc zapisuje stav do session-env/<sessionId>/tsc-status pro statusLine.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const theme = require(path.join(os.homedir(), '.claude', 'lib', 'theme.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const file = (data?.tool_input?.file_path || '').replace(/\\/g, '/');
  if (!file || !/\.(ts|tsx)$/.test(file)) process.exit(0);
  if (/\.d\.ts$/.test(file)) process.exit(0);

  const sessionId = data?.session_id || '';

  let dir = path.dirname(file);
  let tsconfigDir = null;
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'tsconfig.json'))) {
      tsconfigDir = dir;
      break;
    }
    dir = path.dirname(dir);
  }
  if (!tsconfigDir) process.exit(0);

  try {
    execSync('npx tsc --noEmit', {
      cwd: tsconfigDir,
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    writeStatus(sessionId, { ok: true, errors: 0, file, timestamp: Date.now() });
    process.exit(0);
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    const relEdited = path.relative(tsconfigDir, file).replace(/\\/g, '/');
    const lines = out.split('\n').filter(l =>
      l.includes(relEdited) || l.includes(path.basename(file))
    );

    writeStatus(sessionId, { ok: false, errors: lines.length, file: relEdited, timestamp: Date.now() });

    if (lines.length === 0) process.exit(0);

    const top = lines.slice(0, 5).map(l => compactError(l, tsconfigDir));
    const boxLines = [...top];
    if (lines.length > 5) boxLines.push(`… a dalších ${lines.length - 5}`);
    boxLines.push('');
    boxLines.push(`${theme.glyphs().bulb} tip: spusť /tsc pro plný output`);

    const g = theme.glyphs();
    console.log(theme.box({
      title: `${g.warn} tsc · ${lines.length} chyb v ${relEdited}`,
      lines: boxLines,
    }));
    process.exit(0);
  }
});

function writeStatus(sessionId, status) {
  if (!sessionId) return;
  const dir = path.join(os.homedir(), '.claude', 'session-env', sessionId);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tsc-status'), JSON.stringify(status));
  } catch {}
}

// Zkrať `path/to/file.ts(42,5): error TS2345: message` na `42: message`
function compactError(line, tsconfigDir) {
  const m = line.match(/\((\d+),\d+\):\s*error\s+TS\d+:\s*(.+)$/);
  if (m) return `${m[1]}: ${m[2].trim()}`;
  return line.trim();
}
