#!/usr/bin/env node
// PostToolUse (Write/Edit na *.ts/*.tsx): rychlý tsc check.
// Nezdržuje — běží s timeoutem 20 s a reportuje jen chyby v právě editovaném souboru.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const file = (data?.tool_input?.file_path || '').replace(/\\/g, '/');
  if (!file || !/\.(ts|tsx)$/.test(file)) process.exit(0);
  // Skip .d.ts generované výstupy
  if (/\.d\.ts$/.test(file)) process.exit(0);

  const cwd = (data?.cwd || process.cwd()).replace(/\\/g, '/');

  // Najdi nejbližší tsconfig.json od editovaného souboru směrem nahoru.
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
    // Úspěch — nic neohlašujeme, ať Claude nespamuje.
    process.exit(0);
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    const relEdited = path.relative(tsconfigDir, file).replace(/\\/g, '/');
    // Report jen chyby obsahující editovaný soubor.
    const lines = out.split('\n').filter(l =>
      l.includes(relEdited) || l.includes(path.basename(file))
    );
    if (lines.length === 0) {
      // Chyby existují jinde — neřeš, mohly existovat už předtím.
      process.exit(0);
    }
    const top = lines.slice(0, 5).join('\n');
    console.log(`⚠️  tsc hlásí chyby v ${relEdited}:\n${top}${lines.length > 5 ? `\n... a dalších ${lines.length - 5}` : ''}`);
    process.exit(0);
  }
});
