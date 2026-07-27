#!/usr/bin/env node
// Zápis odpovědi uživatele na nabídku dokumentace, aby se doc-check hook
// u stejného projektu neptal znovu.
//
//   node scripts/doc-state.js --skip [cesta]        uživatel nechce
//   node scripts/doc-state.js --done [cesta] [nota] poznámka hotová
//   node scripts/doc-state.js --defer [cesta]       odlož do repa (zapiš doma)
//   node scripts/doc-state.js --clear [cesta]       zapomeň, ptej se zas
//   node scripts/doc-state.js --status [cesta]      co je zapsané
//
// Cesta je volitelná, default cwd. Git root se dohledá sám, ať je jedno
// z jakého podadresáře se to zavolá.

const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const vault = require(path.join(os.homedir(), '.claude', 'lib', 'obsidian-vault.js'));

const USAGE = `Použití:
  doc-state.js --skip   [cesta]         uživatel dokumentaci nechce
  doc-state.js --done   [cesta] [nota]  poznámka ve vaultu hotová (smaže i marker)
  doc-state.js --defer  [cesta]         odlož do repa — zapíše se na stroji s osobním vaultem
  doc-state.js --clear  [cesta]         smaž zápis, hook se zeptá znovu
  doc-state.js --status [cesta]         vypiš stav`;

function resolveRoot(p) {
  const start = path.resolve(p || process.cwd());
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: start,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return start;
  }
}

function main(argv) {
  const cmd = argv[0];
  if (!cmd || !['--skip', '--done', '--defer', '--clear', '--status'].includes(cmd)) {
    console.error(USAGE);
    return 1;
  }

  const root = resolveRoot(argv[1]);

  switch (cmd) {
    case '--skip':
      vault.setStatus(root, 'declined');
      console.log(`OK — ${root}: dokumentace odmítnuta, hook se už ptát nebude.`);
      return 0;
    case '--done': {
      const note = argv[2] || null;
      vault.setStatus(root, 'documented', note ? { note } : {});
      // Poznámka je ve vaultu → odložený marker už nemá co dělat v repu.
      const hadPending = vault.clearPending(root);
      console.log(`OK — ${root}: zdokumentováno${note ? ` (${note})` : ''}.`);
      if (hadPending) console.log(`     smazán i ${vault.PENDING_REL} — nezapomeň to commitnout.`);
      return 0;
    }
    case '--defer': {
      const { projectInfo } = require(path.join(os.homedir(), '.claude', 'lib', 'project-info.js'));
      const proj = projectInfo(root);
      const p = vault.writePending(root, { name: proj.name, type: proj.type, language: proj.language });
      if (!p) {
        console.error(`CHYBA — ${root}: marker se nepodařilo zapsat.`);
        return 1;
      }
      console.log(`OK — ${root}: odloženo do ${vault.PENDING_REL}.`);
      console.log(`     Commitni to; na stroji s osobním vaultem (${vault.PERSONAL_VAULT}) se dokumentace nabídne po pullu.`);
      return 0;
    }
    case '--clear':
      vault.clearStatus(root);
      console.log(`OK — ${root}: stav smazán, hook se příště zeptá.`);
      return 0;
    case '--status': {
      const s = vault.getStatus(root);
      const scope = vault.projectScope(root);
      console.log(`${root}`);
      console.log(`  scope:  ${scope}`);
      console.log(`  vault:  ${vault.vaultPath(root)}${vault.vaultExists(root) ? '' : ' (neexistuje)'}`);
      console.log(`  stav:   ${s ? `${s.status} (${s.ts})${s.note ? ` — ${s.note}` : ''}` : 'nic zapsáno'}`);
      if (vault.readPending(root)) console.log(`  odloženo: ${vault.PENDING_REL} čeká na zápis`);
      return 0;
    }
  }
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main, resolveRoot };
