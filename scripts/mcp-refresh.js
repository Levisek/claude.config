#!/usr/bin/env node
// Background refresher pro mcp-status cache.
// Spouští se detached z statusline.js (fire-and-forget) když je cache stale.
// Cíl: PowerShell + CIM query (~2s) nesmí blokovat hot path statusline.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const cachePath = path.join(os.homedir(), '.claude', 'cache', 'mcp-status.json');
const lockPath = cachePath + '.lock';

// Single-flight lock — zabráníme tomu, aby několik detached refreshů běželo paralelně.
try {
  const lockAge = fs.existsSync(lockPath) ? Date.now() - fs.statSync(lockPath).mtimeMs : Infinity;
  if (lockAge < 30_000) process.exit(0); // jiný refresh běží (lock <30s starý)
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, String(process.pid));
} catch {}

let serenaUp = false;
try {
  const r = spawnSync('powershell', [
    '-NoProfile', '-Command',
    "(Get-CimInstance Win32_Process | Where-Object { $_.Name -in 'serena.exe','python.exe' -and $_.CommandLine -like '*start-mcp-server*' } | Measure-Object).Count"
  ], { encoding: 'utf8', timeout: 8000, windowsHide: true });
  serenaUp = parseInt(String(r.stdout).trim(), 10) > 0;
} catch {}

try {
  fs.writeFileSync(cachePath, JSON.stringify({ t: Date.now(), serena: serenaUp }));
} catch {}

try { fs.unlinkSync(lockPath); } catch {}
