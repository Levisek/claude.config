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

// Na Windows jede Bash tool přes PowerShell (nebo cmd), takže bashová pravidla
// tam nechytnou vůbec nic. Staré pravidlo pro Remove-Item vyžadovalo `-recurse`
// PŘED `-force` a k tomu písmeno disku — obě podmínky se daly minout omylem.
test('rekurzivní mazání na Windows se blokuje', () => {
  assert.strictEqual(blocked('Remove-Item -Recurse -Force C:\\dev\\tmp'), true);
  assert.strictEqual(blocked('Remove-Item -Force -Recurse C:\\dev\\tmp'), true,
    'pořadí přepínačů nesmí rozhodovat');
  assert.strictEqual(blocked('Remove-Item -Recurse -Force ~\\projekty'), true,
    'cesta bez písmene disku je stejně destruktivní');
  assert.strictEqual(blocked('rd /s /q C:\\dev\\tmp'), true);
  assert.strictEqual(blocked('del /f /s /q C:\\dev\\*'), true);
});

test('adresné mazání jednoho souboru projde', () => {
  assert.strictEqual(blocked('Remove-Item C:\\dev\\soubor.txt'), false);
  assert.strictEqual(blocked('del C:\\dev\\soubor.txt'), false);
  assert.strictEqual(blocked('git rm --cached soubor.txt'), false);
});

// 2026-09-09: hook zablokoval zápis TODO, ve kterém byl destruktivní tvar
// napsaný jako text dokumentace uvnitř heredocu. Rozhoduje pozice — příkaz
// stojí na začátku, za oddělovačem, nebo za obalovačem typu `sudo`.
test('věta o příkazu není příkaz', () => {
  assert.strictEqual(
    blocked('cat > poznamka.md <<\'MD\'\nDeny list nechytne rekurzivní `Remove-Item -Recurse -Force`.\nMD'),
    false, 'zmínka v dokumentaci uvnitř heredocu');
  assert.strictEqual(
    blocked('echo "rm -rf / smaže celý disk"'), false,
    'zmínka v uvozovkách');
  assert.strictEqual(
    blocked('git commit -m "popsat, proč se nepoužívá git push --force"'), false,
    'zmínka ve zprávě commitu');
  // Roura je oddělovač úseků, takže tenhle tvar potřeboval vlastní ošetření —
  // a hook na něm 2026-09-09 spadl podruhé, při psaní vlastní zprávy commitu.
  assert.strictEqual(
    blocked('git commit -m "pravidlo pro Get-Process | Stop-Process ma priznak kdekoli"'),
    false, 'zmínka o rouře ve zprávě commitu');
});

test('výběr procesů zakončený ukončením se blokuje i přes filtr', () => {
  assert.strictEqual(
    blocked('Get-Process node | Where-Object { $_.CPU -gt 10 } | Stop-Process -Force'),
    true, 'mezi výběrem a ukončením smí stát filtr');
});

test('obalovače a přiřazení proměnných hook neobejdou', () => {
  assert.strictEqual(blocked('sudo rm -rf /'), true);
  assert.strictEqual(blocked('sudo -u root rm -rf /'), true, 'sudo s přepínačem');
  assert.strictEqual(blocked('env FOO=bar rm -rf /'), true);
  assert.strictEqual(blocked('TMPDIR=/x rm -rf /'), true, 'přiřazení před příkazem');
  assert.strictEqual(blocked('true; rm -rf /'), true, 'za oddělovačem');
  assert.strictEqual(blocked('rm -rf ${HOME}'), true, 'závorky nesmí rozseknout proměnnou');
});
