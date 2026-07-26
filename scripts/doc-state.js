#!/usr/bin/env node
// Zápis odpovědi uživatele na nabídku dokumentace, aby se doc-check hook
// u stejného projektu neptal znovu.
//
//   node scripts/doc-state.js --skip [cesta]        uživatel nechce
//   node scripts/doc-state.js --done [cesta] [nota] poznámka hotová
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
  doc-state.js --done   [cesta] [nota]  poznámka ve vaultu hotová
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
  if (!cmd || !['--skip', '--done', '--clear', '--status'].includes(cmd)) {
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
      console.log(`OK — ${root}: zdokumentováno${note ? ` (${note})` : ''}.`);
      return 0;
    }
    case '--clear':
      vault.clearStatus(root);
      console.log(`OK — ${root}: stav smazán, hook se příště zeptá.`);
      return 0;
    case '--status': {
      const s = vault.getStatus(root);
      console.log(s ? `${root}: ${s.status} (${s.ts})${s.note ? `\n  ${s.note}` : ''}` : `${root}: nic zapsáno`);
      return 0;
    }
  }
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main, resolveRoot };
