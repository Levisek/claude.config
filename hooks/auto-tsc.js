#!/usr/bin/env node
// PostToolUse (Write/Edit na *.ts/*.tsx): rychlý tsc check.
// Nezdržuje — běží s timeoutem 20 s a reportuje jen chyby v právě editovaném souboru.
// Navíc zapisuje stav do session-env/<sessionId>/tsc-status pro statusLine.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

  // Domácí server nemá npm ani npx, jen node — `npx tsc` tam skončí hláškou
  // "command not found". To se od skutečných chyb překladu nijak neliší:
  // zapsalo se `ok:false, errors:0` a test-gate od té chvíle blokoval každý
  // `git push` hláškou "? error(s)", i když byl překlad čistý.
  // Proto se napřed hledá tsc v repozitáři; npx je až záloha.
  //
  // Hledá se SMĚREM NAHORU, ne jen vedle tsconfigu: podprojekt má klidně
  // vlastní `tsconfig.json`, ale `node_modules` leží až v kořeni repozitáře
  // (levis-ide/mobil). Bez toho hook na podprojektu zase spadl na npx.
  let mistniTsc = null;
  for (let d = tsconfigDir; ; d = path.dirname(d)) {
    const kandidat = path.join(d, 'node_modules', 'typescript', 'bin', 'tsc');
    if (fs.existsSync(kandidat)) { mistniTsc = kandidat; break; }
    if (d === path.dirname(d)) break;
  }
  const prikaz = mistniTsc
    ? `"${process.execPath}" "${mistniTsc}" --noEmit`
    : 'npx tsc --noEmit';

  try {
    execSync(prikaz, {
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

    const isTimeout = e.code === 'ETIMEDOUT' || e.signal === 'SIGTERM';
    writeStatus(sessionId, { ok: false, errors: lines.length, file: relEdited, timestamp: Date.now(), timeout: isTimeout });

    if (lines.length === 0) {
      if (isTimeout) sdel(`tsc timeout (20 s) u ${relEdited} — spusť /tsc ručně.`);
      process.exit(0);
    }

    const top = lines.slice(0, 5).map(l => compactError(l, tsconfigDir));
    if (lines.length > 5) top.push(`… a dalších ${lines.length - 5}`);
    sdel([`tsc: ${lines.length} chyb v ${relEdited}`, ...top, 'Plný výstup: /tsc.'].join('\n'));
    process.exit(0);
  }
});

// Holý stdout z PostToolUse model nevidí (jen přepis v TUI přes Ctrl+R),
// v chatu LevisIDE ho nevidí nikdo. K modelu se dostane jen JSON
// s additionalContext — ověřeno 2026-09-30 pokusem přes Agent SDK.
function sdel(text) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text },
  }));
}

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
