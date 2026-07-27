// Obsidian vault pro dev projekty: kde leží, jestli už má poznámku k projektu,
// a jestli se uživatel u daného projektu už vyjádřil.
//
// Vaulty jsou DVA, protože pracovní stroj nesmí dostat osobní poznámky:
//   work     → C:\dev\Work\Obsidian  (projekty pod C:\dev\Work)
//   personal → C:\dev\vault          (všechno ostatní)
// Obojí přepsatelné přes env (CLAUDE_OBSIDIAN_VAULT_WORK / CLAUDE_OBSIDIAN_VAULT).
//
// Když osobní projekt otevřeš na stroji, kde osobní vault není, poznámka se
// nepíše — místo toho se do repa založí `.claude/doc-pending.md`, který se
// commitne a na druhém stroji ho doc-check po pullu najde. Handoff přes git,
// ne přes sdílený disk.
//
// Poznámky projektů žijí v podsložce "🚀 Projekty" a mají v názvu emoji prefix,
// takže detekce nesmí spoléhat na přesný název souboru — hledá se podle jména
// projektu kdekoliv v názvu.

const fs = require('fs');
const path = require('path');
const os = require('os');

const WORK_ROOT = process.env.CLAUDE_WORK_ROOT || path.join('C:', 'dev', 'Work');
const WORK_VAULT = process.env.CLAUDE_OBSIDIAN_VAULT_WORK || path.join('C:', 'dev', 'Work', 'Obsidian');
const PERSONAL_VAULT = process.env.CLAUDE_OBSIDIAN_VAULT || path.join('C:', 'dev', 'vault');
const PENDING_REL = path.join('.claude', 'doc-pending.md');
const PROJECTS_DIR = '🚀 Projekty';
const STATE_FILE = path.join(os.homedir(), '.claude', 'cache', 'doc-check-state.json');

// Normalizace pro porovnávání názvů: bez emoji, bez diakritiky, bez oddělovačů.
// "🧩 Levis-IDE.md" a "levis ide" musí dát stejný klíč, jinak by hook nabízel
// dokumentaci k projektu, který ji už má.
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function projectKey(root) {
  return path.resolve(root).toLowerCase();
}

// 'work' = projekt leží pod WORK_ROOT. Rozhoduje cesta, ne git remote —
// remote se dá přepnout a klonovat, umístění na disku je to, co uživatel
// reálně vnímá jako „tohle je pracovní".
function projectScope(root) {
  const p = path.resolve(root).toLowerCase();
  const w = path.resolve(WORK_ROOT).toLowerCase();
  return p === w || p.startsWith(w + path.sep) ? 'work' : 'personal';
}

function vaultPath(root) {
  return projectScope(root || process.cwd()) === 'work' ? WORK_VAULT : PERSONAL_VAULT;
}

// Obě cesty naráz — pro kontroly typu „nejsem náhodou uvnitř vaultu?".
function allVaults() {
  return [WORK_VAULT, PERSONAL_VAULT];
}

function vaultExists(root) {
  try {
    return fs.statSync(vaultPath(root)).isDirectory();
  } catch {
    return false;
  }
}

function projectsDir(root) {
  return path.join(vaultPath(root), PROJECTS_DIR);
}

// Vrátí cestu k existující poznámce projektu, nebo null.
function findNote(projectName, root) {
  const target = normalize(projectName);
  if (!target) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(projectsDir(root));
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.endsWith('.md')) continue;
    if (normalize(e.slice(0, -3)) === target) return path.join(projectsDir(root), e);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pending marker — handoff osobního projektu z pracovního stroje domů.
// Žije v repu (commituje se), ne ve state cache, protože právě přenos přes
// git je celý smysl: doma se objeví po pullu.
// ---------------------------------------------------------------------------

function pendingPath(root) {
  return path.join(root, PENDING_REL);
}

function readPending(root) {
  try {
    return fs.readFileSync(pendingPath(root), 'utf8');
  } catch {
    return null;
  }
}

function writePending(root, info = {}) {
  const p = pendingPath(root);
  const docs = info.docs && info.docs.length ? info.docs.join(', ') : 'žádná';
  const body = [
    '---',
    'doc-pending: true',
    `projekt: ${info.name || path.basename(root)}`,
    `vytvoreno: ${new Date().toISOString()}`,
    `stroj: ${info.machine || 'work'}`,
    '---',
    '',
    '# Zapsat do osobního Obsidian vaultu',
    '',
    'Na tomhle projektu se pracovalo na stroji, kde osobní vault není dostupný,',
    'takže se poznámka odložila sem. Až repo otevřeš na stroji s osobním vaultem,',
    '`doc-check` si toho všimne a nabídne dokumentaci — skill `obsidian-docs`',
    'poznámku napíše a tenhle soubor pak smaž (`doc-state.js --done .`).',
    '',
    `- **Projekt:** ${info.name || path.basename(root)}`,
    info.type && info.type !== 'none' ? `- **Typ:** ${info.type}${info.language ? ` / ${info.language}` : ''}` : null,
    `- **Kořen na původním stroji:** \`${root}\``,
    `- **Dokumentace v repu:** ${docs}`,
    '',
  ]
    .filter(l => l !== null)
    .join('\n');
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    return p;
  } catch {
    return null;
  }
}

function clearPending(root) {
  try {
    fs.unlinkSync(pendingPath(root));
    return true;
  } catch {
    return false;
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch {
    return false;
  }
}

// 'declined' = uživatel řekl ne. Neptáme se znovu, dokud stav někdo nesmaže —
// opakovaný dotaz na každý start session je přesně ta otravnost, kvůli které
// lidi hooky vypínají.
function getStatus(root) {
  const s = readState();
  return s[projectKey(root)] || null;
}

function setStatus(root, status, extra = {}) {
  const s = readState();
  s[projectKey(root)] = { status, ts: new Date().toISOString(), ...extra };
  return writeState(s);
}

function clearStatus(root) {
  const s = readState();
  delete s[projectKey(root)];
  return writeState(s);
}

module.exports = {
  vaultPath,
  vaultExists,
  allVaults,
  projectScope,
  projectsDir,
  findNote,
  getStatus,
  setStatus,
  clearStatus,
  projectKey,
  normalize,
  pendingPath,
  readPending,
  writePending,
  clearPending,
  STATE_FILE,
  PROJECTS_DIR,
  PENDING_REL,
  WORK_ROOT,
  WORK_VAULT,
  PERSONAL_VAULT,
};
