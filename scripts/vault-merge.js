#!/usr/bin/env node
// Jednorázová migrace: vault Domácího serveru → C:\dev\vault.
//
//   node scripts/vault-merge.js            dry-run, nic nemění
//   node scripts/vault-merge.js --apply    provede přesun
//
// Přesouvá se přes `git mv`, takže historie zůstane a celé to jde vrátit
// jedním `git reset --hard`. Zdrojový vault je plně commitnutý — to skript
// ověřuje a bez čistého stromu odmítne běžet.
//
// POZOR: neběží, když má Obsidian zdrojový vault otevřený. Obsidian si za
// běhu přepisuje `.obsidian/` (workspace state), takže by přesun skončil
// napůl — část v novém vaultu, část znovu vytvořená v původním.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC_REPO = path.join('C:', 'dev', 'Domaci server');
const SRC_VAULT = path.join(SRC_REPO, 'docs', 'vault');
const DST = path.join('C:', 'dev', 'vault');
const OBSIDIAN_CFG = path.join(
  process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'),
  'obsidian',
  'obsidian.json'
);

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');

function fail(msg) {
  console.error('STOP: ' + msg);
  process.exit(1);
}

function git(args, cwd = SRC_REPO) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

// --- Kontroly -------------------------------------------------------------

function checkObsidianClosed() {
  let running = 0;
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Obsidian.exe', '/FO', 'CSV'], {
      encoding: 'utf8',
    });
    running = out.split('\n').filter(l => l.includes('Obsidian.exe')).length;
  } catch {}

  let vaultOpen = false;
  try {
    const cfg = JSON.parse(fs.readFileSync(OBSIDIAN_CFG, 'utf8'));
    vaultOpen = Object.values(cfg.vaults || {}).some(
      v => v.open && path.resolve(v.path).toLowerCase() === path.resolve(SRC_VAULT).toLowerCase()
    );
  } catch {}

  // Rozhoduje POUZE počet procesů. Flag `open` v obsidian.json je perzistovaný
  // stav posledního otevření, ne živá informace — po zavření Obsidianu tam
  // pořád svítí `open: true`. Podmínka `running && vaultOpen` by proto při
  // zaseknutém flagu prošla i s běžící aplikací. Fail-closed: běží → stop.
  if (running > 0 && !force) {
    fail(
      `Obsidian běží (${running} procesů). Zavři ho a spusť znovu.\n` +
        '      Zabíjet ho nebudu — přesun souborů pod běžící aplikací skončí napůl.\n' +
        '      (--force kontrolu přeskočí, ale pak si za výsledek ručíš sám.)'
    );
  }
  return { running, vaultOpen };
}

function checkClean() {
  const dirty = git(['status', '--porcelain']).trim();
  if (dirty) fail(`repo ${SRC_REPO} má necommitnuté změny:\n${dirty}`);
}

// --- Plán -----------------------------------------------------------------

// Co se kam přesune. Složky, které v cíli existují, se slučují po souborech;
// zbytek jde celý. `.obsidian` se NEpřesouvá — nový vault si vytvoří vlastní
// při prvním otevření, a tahat s sebou workspace state běžící aplikace je
// právě ta věc, co migraci rozbije.
function buildPlan() {
  const entries = fs.readdirSync(SRC_VAULT, { withFileTypes: true });
  const moves = [];
  const skipped = [];

  for (const e of entries) {
    if (e.name === '.obsidian') {
      skipped.push(e.name + '  (workspace state, nový vault si udělá vlastní)');
      continue;
    }
    const from = path.join(SRC_VAULT, e.name);

    if (e.isDirectory()) {
      // Slučovaná složka → po souborech, ať nepřepíšu cílové noty.
      const dstDir = path.join(DST, e.name);
      if (fs.existsSync(dstDir)) {
        for (const f of fs.readdirSync(from)) {
          const target = path.join(dstDir, f);
          if (fs.existsSync(target)) {
            skipped.push(path.join(e.name, f) + '  (v cíli už existuje)');
          } else {
            moves.push({ from: path.join(from, f), to: target });
          }
        }
      } else {
        moves.push({ from, to: dstDir, dir: true });
      }
    } else {
      const target = path.join(DST, e.name);
      if (fs.existsSync(target)) skipped.push(e.name + '  (v cíli už existuje)');
      else moves.push({ from, to: target });
    }
  }
  return { moves, skipped };
}

// --- Běh ------------------------------------------------------------------

function main() {
  if (!fs.existsSync(SRC_VAULT)) fail(`zdrojový vault neexistuje: ${SRC_VAULT}`);
  if (!fs.existsSync(DST)) fail(`cílový vault neexistuje — nejdřív: node scripts/vault-init.js`);

  const obs = checkObsidianClosed();
  checkClean();

  const { moves, skipped } = buildPlan();

  console.log(`Zdroj: ${SRC_VAULT}`);
  console.log(`Cíl:   ${DST}`);
  console.log(`Obsidian: ${obs.running} procesů, zdrojový vault otevřený: ${obs.vaultOpen ? 'ANO' : 'ne'}\n`);

  console.log(`Přesune se (${moves.length}):`);
  for (const m of moves) {
    console.log(`  ${path.relative(SRC_VAULT, m.from)}${m.dir ? '/' : ''}  →  ${path.relative(DST, m.to)}${m.dir ? '/' : ''}`);
  }
  if (skipped.length) {
    console.log(`\nPřeskočí se (${skipped.length}):`);
    skipped.forEach(s => console.log('  ' + s));
  }

  if (!apply) {
    console.log('\n--- DRY RUN, nic se nezměnilo. Spusť s --apply. ---');
    return 0;
  }

  for (const m of moves) {
    fs.mkdirSync(path.dirname(m.to), { recursive: true });
    // git mv drží historii; cíl je mimo repo, takže git to vezme jako delete
    // ve zdroji + untracked soubor v cíli. Proto ruční rename + git rm.
    fs.renameSync(m.from, m.to);
  }

  git(['add', '-A', 'docs/vault']);
  console.log(`\nHotovo — přesunuto ${moves.length} položek.`);
  console.log(`Zdroj má teď smazané soubory ve stagi. Zkontroluj a commitni v ${SRC_REPO}.`);
  console.log('Vrácení, dokud není commit:  git -C "' + SRC_REPO + '" reset --hard');
  console.log('\nV Obsidianu: Open folder as vault → ' + DST);
  return 0;
}

if (require.main === module) process.exit(main());
