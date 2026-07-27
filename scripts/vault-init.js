#!/usr/bin/env node
// Založí Obsidian vault pro dev projekty. Idempotentní — co existuje, nechá být.
//
//   node scripts/vault-init.js [cesta]
//
// Vault se do Obsidianu NEregistruje: %APPDATA%\obsidian\obsidian.json patří
// běžící aplikaci a zápis do něj by se buď ztratil, nebo rozbil její stav.
// Uživatel udělá jednou "Open folder as vault".

const fs = require('fs');
const path = require('path');
const os = require('os');

const vault = require(path.join(os.homedir(), '.claude', 'lib', 'obsidian-vault.js'));

const FOLDERS = ['🚀 Projekty', '💡 Poučení', '🚨 Runbooky'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

const INDEX = `---
tags: [index, projekty]
aktualizovano: ${today()}
---

# Projekty

Rozcestník k dokumentaci dev projektů. Poznámka vzniká, když se projekt poprvé
otevře v Claude Code — hook \`doc-check\` si všimne, že tu ještě není, a nabídne
ji založit.

> [!info] Kde co leží
> **Vault:** \`{{VAULT}}\`
> **Poznámky projektů:** \`🚀 Projekty/\`
> **Konvence:** stejné jako vault *Domácí server* — emoji v názvech, frontmatter
> \`tags\` + \`aktualizovano\`, callouty, wikilinky.

## 🚀 Projekty

| Projekt | O čem to je | Stav |
|---|---|---|

## 💡 Poučení

Netriviální překvapení, která stojí za zapamatování. Název poznámky je tvrzení,
ne otázka.

## 🚨 Runbooky

Postupy pro situace, které se opakují a člověk si je nepamatuje.
`;

function main(argv) {
  const target = argv[0] ? path.resolve(argv[0]) : vault.vaultPath();
  const created = [];
  const skipped = [];

  for (const dir of [target, ...FOLDERS.map(f => path.join(target, f))]) {
    if (fs.existsSync(dir)) {
      skipped.push(path.relative(target, dir) || '.');
    } else {
      fs.mkdirSync(dir, { recursive: true });
      created.push(path.relative(target, dir) || '.');
    }
  }

  const indexPath = path.join(target, '🏠 Projekty.md');
  if (fs.existsSync(indexPath)) {
    skipped.push('🏠 Projekty.md');
  } else {
    fs.writeFileSync(indexPath, INDEX.replace('{{VAULT}}', target));
    created.push('🏠 Projekty.md');
  }

  console.log(`Vault: ${target}`);
  if (created.length) console.log(`  vytvořeno: ${created.join(', ')}`);
  if (skipped.length) console.log(`  už bylo:   ${skipped.join(', ')}`);
  if (created.length) {
    console.log('\nV Obsidianu jednou udělej: Open folder as vault → ' + target);
  }
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main, FOLDERS };
