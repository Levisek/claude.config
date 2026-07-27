// Testy kill-guardu v block-destructive.js. Hook se spouští přes spawn se
// vstupem na stdin — nikdy neskládej testované příkazy do shellu, kterým test
// pouštíš: hook je součástí PreToolUse a zablokoval by sám sebe.
//
// Pravidlo, které se tu hlídá: škodí *selektor*, ne signál. Výběr procesu podle
// jména/vzoru/portu sáhne i na cizí okna (incident 2026-04-14 — kill Electronu
// shodil uživateli Chrome), zatímco adresný numerický PID je v pořádku.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOK = path.join(os.homedir(), '.claude', 'hooks', 'block-destructive.js');

function blocked(command) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
  });
  return r.status === 2;
}

const BLOCK = [
  'taskkill /F /IM electron.exe',
  'taskkill /PID 1234 /T',
  'Stop-Process -Name chrome',
  'Get-Process node | Stop-Process -Force',
  'pkill -f electron',
  'killall node',
  'npx kill-port 3000',
  'fuser -k 8080/tcp',
  'wmic process where name="node.exe" delete',
  'Invoke-CimMethod -MethodName Terminate',
];

const ALLOW = [
  'taskkill /F /PID 1234',
  'Stop-Process -Id 4321',
  'tasklist //FI "IMAGENAME eq electron.exe"',
  'npm run dev',
  'docker stop mycontainer',
];

test('kill podle jména, vzoru nebo portu se blokuje', () => {
  for (const cmd of BLOCK) {
    assert.strictEqual(blocked(cmd), true, `mělo být zablokováno: ${cmd}`);
  }
});

test('adresný PID a běžná práce projdou', () => {
  for (const cmd of ALLOW) {
    assert.strictEqual(blocked(cmd), false, `nemělo být zablokováno: ${cmd}`);
  }
});

test('původní destruktivní patterny pořád platí', () => {
  assert.strictEqual(blocked('rm -rf /'), true);
  assert.strictEqual(blocked('git push --force origin main'), true);
  assert.strictEqual(blocked('git push --force-with-lease'), false);
});
