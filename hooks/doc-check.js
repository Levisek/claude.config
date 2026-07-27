#!/usr/bin/env node
// SessionStart: pokud otevřený projekt nemá poznámku v Obsidian vaultu,
// injektuje do kontextu pokyn nabídnout dokumentaci.
//
// Hook se sám nikoho nezeptá — SessionStart umí jen přidat `additionalContext`.
// Dotaz proto položí Claude v prvním tahu. Odpověď se zapíše přes
// `scripts/doc-state.js`, aby se hook u stejného projektu neptal donekonečna.
//
// Ticho je default: cokoliv nejasného (není to projekt, chybí vault, uživatel
// už odpověděl) končí prázdným výstupem.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const vault = require(path.join(os.homedir(), '.claude', 'lib', 'obsidian-vault.js'));
const { projectInfo } = require(path.join(os.homedir(), '.claude', 'lib', 'project-info.js'));

// Složky, kde dokumentaci projektu nabízet nedává smysl.
function isSkippablePath(dir) {
  const p = path.resolve(dir).toLowerCase();
  const home = path.resolve(os.homedir()).toLowerCase();
  if (p === home) return true;
  for (const v of vault.allVaults()) {
    if (p === path.resolve(v).toLowerCase()) return true;
  }
  return /[\\/](appdata|temp|tmp|node_modules|\.git|scratchpad|downloads)([\\/]|$)/.test(p);
}

function gitRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

// „Reálný projekt" = má git repo nebo rozpoznaný build marker. Prázdná složka
// s jedním souborem dokumentaci nepotřebuje.
function isRealProject(root, proj) {
  if (proj.hasPackageJson || proj.hasTsconfig) return true;
  if (fs.existsSync(path.join(root, '.git'))) return true;
  for (const m of ['Cargo.toml', 'go.mod', 'pyproject.toml', 'requirements.txt', 'pom.xml', 'CLAUDE.md']) {
    if (fs.existsSync(path.join(root, m))) return true;
  }
  return false;
}

// Existující dokumentace v repu — nesuplujeme ji, ale je to dobrý podklad,
// tak ať o ní Claude ví a nabídne „převedu README do vaultu" místo psaní od nuly.
function localDocs(root) {
  const found = [];
  // Windows FS je case-insensitive, takže statSync('readme.md') uspěje i pro
  // README.md a soubor by se započítal dvakrát. Deduplikace podle lowercase.
  const seen = new Set();
  for (const f of ['README.md', 'readme.md', 'ARCHITECTURE.md', 'CONTRIBUTING.md', 'STATUS.md']) {
    if (seen.has(f.toLowerCase())) continue;
    const p = path.join(root, f);
    try {
      const st = fs.statSync(p);
      if (st.isFile() && st.size > 0) {
        found.push({ file: f, bytes: st.size });
        seen.add(f.toLowerCase());
      }
    } catch {}
  }
  for (const d of ['docs', 'doc']) {
    try {
      if (fs.statSync(path.join(root, d)).isDirectory()) found.push({ file: d + '/', bytes: null });
    } catch {}
  }
  return found;
}

// Projekt, který si vozí vlastní Obsidian vault, dokumentaci evidentně řeší
// po svém (tak to má Domácí server). Nabízet mu druhou je otravné.
function hasOwnVault(root) {
  for (const rel of ['.obsidian', path.join('docs', 'vault', '.obsidian'), path.join('docs', '.obsidian')]) {
    try {
      if (fs.statSync(path.join(root, rel)).isDirectory()) return true;
    } catch {}
  }
  return false;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (input += c));
process.stdin.on('end', () => {
  let data = {};
  try {
    data = JSON.parse(input || '{}');
  } catch {}

  // Jen čerstvý start. Resume/compact/clear znamená, že session už běží a
  // uživatel řeší něco jiného — vpadnout tam s dotazem na dokumentaci je rušivé.
  if ((data?.source || 'startup') !== 'startup') return;

  const cwd = data?.cwd || data?.workspace?.current_dir || process.cwd();
  if (isSkippablePath(cwd)) return;

  const root = gitRoot(cwd) || cwd;
  if (isSkippablePath(root)) return;

  const proj = projectInfo(root);
  if (!isRealProject(root, proj)) return;
  if (hasOwnVault(root)) return;

  // Uživatel se už vyjádřil — mlč.
  const status = vault.getStatus(root);
  if (status) return;

  const scope = vault.projectScope(root);
  const haveVault = vault.vaultExists(root);
  const pending = vault.readPending(root);

  // Poznámka existuje → projekt je zdokumentovaný, jen si to poznač do stavu,
  // ať se příště nemusí prohledávat vault.
  const note = haveVault ? vault.findNote(proj.name, root) : null;
  if (note) {
    vault.setStatus(root, 'documented', { note });
    return;
  }

  const docs = localDocs(root);
  const docsLine = docs.length
    ? docs.map(d => (d.bytes ? `${d.file} (${d.bytes} B)` : d.file)).join(', ')
    : 'žádná';

  // Osobní projekt na stroji bez osobního vaultu (typicky: sedím v práci).
  // Poznámku sem psát nemůžu, tak ji odložím do repa a jdu z cesty. Marker
  // se vytvoří jen jednou — podruhé už tu nemám co dělat.
  if (scope === 'personal' && !haveVault) {
    if (pending) return;
    const written = vault.writePending(root, {
      name: proj.name,
      type: proj.type,
      language: proj.language,
      machine: 'work',
      docs: docs.map(d => d.file),
    });
    if (!written) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: [
            '',
            `> [!note] Dokumentace projektu odložena do \`${vault.PENDING_REL}\``,
            `> Osobní projekt, ale osobní vault (\`${vault.PERSONAL_VAULT}\`) na tomhle stroji není.`,
            '> Marker je v repu — po commitu a pullu na domácím stroji se dokumentace nabídne sama.',
            '',
            'Uživateli to **jednou větou zmiň až na konci session** (ať ten soubor commitne),',
            'jinak se tím nezabývej a řeš, s čím přišel.',
            '',
          ].join('\n'),
        },
      })
    );
    return;
  }

  const lines = [
    '',
    pending
      ? '> [!question] Tenhle projekt čeká na zápis do vaultu (odložený z jiného stroje)'
      : '> [!question] Tenhle projekt nemá poznámku v Obsidian vaultu',
    `> **Projekt:** ${proj.name}${proj.type !== 'none' ? ` — ${proj.type} / ${proj.language}` : ''}`,
    `> **Kořen:** \`${root}\``,
    `> **Dokumentace v repu:** ${docsLine}`,
    `> **Vault:** \`${vault.vaultPath(root)}\` (${scope})${haveVault ? '' : ' *(zatím neexistuje — je potřeba založit)*'}`,
    pending ? `> **Odložený marker:** \`${vault.PENDING_REL}\` — přečti si ho, je v něm kontext z původního stroje.` : null,
    '',
    'V **prvním tahu** se uživatele zeptej (česky, jednou větou), jestli chce projekt',
    'zdokumentovat do Obsidianu. Neptej se, pokud uživatel v téhle session rovnou',
    'zadal konkrétní úkol — pak to nadhoď až na jeho konci.',
    '',
    'Podle odpovědi:',
    '- **Ano** → invokuj skill `obsidian-docs`, ten zná konvence vaultu.',
    docs.length
      ? '- Nabídni obojí: převést existující dokumentaci do vaultu, nebo napsat poznámku od nuly.'
      : '- V repu není z čeho vyjít, poznámka se bude psát z průzkumu kódu.',
    pending
      ? '- Po zapsání spusť `node ~/.claude/scripts/doc-state.js --done .` — smaže i odložený marker.'
      : null,
    '- **Ne / teď ne** → spusť `node ~/.claude/scripts/doc-state.js --skip .` a víc to neotvírej.',
    '',
  ].filter(l => l !== null);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: lines.join('\n'),
      },
    })
  );
});
