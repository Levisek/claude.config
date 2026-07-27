// Obsidian vault pro dev projekty: kde leží, jestli už má poznámku k projektu,
// a jestli se uživatel u daného projektu už vyjádřil.
//
// Vault je C:\dev\vault (přepsatelné přes CLAUDE_OBSIDIAN_VAULT). Poznámky
// projektů žijí v podsložce "🚀 Projekty" a mají v názvu emoji prefix, takže
// detekce nesmí spoléhat na přesný název souboru — hledá se podle jména projektu
// kdekoliv v názvu.

const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.CLAUDE_OBSIDIAN_VAULT || path.join('C:', 'dev', 'vault');
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

function vaultPath() {
  return VAULT;
}

function vaultExists() {
  try {
    return fs.statSync(VAULT).isDirectory();
  } catch {
    return false;
  }
}

function projectsDir() {
  return path.join(VAULT, PROJECTS_DIR);
}

// Vrátí cestu k existující poznámce projektu, nebo null.
function findNote(projectName) {
  const target = normalize(projectName);
  if (!target) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(projectsDir());
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.endsWith('.md')) continue;
    if (normalize(e.slice(0, -3)) === target) return path.join(projectsDir(), e);
  }
  return null;
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
  projectsDir,
  findNote,
  getStatus,
  setStatus,
  clearStatus,
  projectKey,
  normalize,
  STATE_FILE,
  PROJECTS_DIR,
};
