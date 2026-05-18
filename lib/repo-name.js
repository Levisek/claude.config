// Resolve canonical repo name pro grouping agent durations a postmortemů.
// Per-process cache (jeden běh skriptu = jedno řešení per cwd).

const { execSync } = require('child_process');
const path = require('path');
const { projectInfo } = require('./project-info.js');

const cache = new Map();

function gitToplevel(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    }).trim();
  } catch {
    return null;
  }
}

function resolveRepoName(cwd = process.cwd()) {
  if (cache.has(cwd)) return cache.get(cwd);

  let name;
  const root = gitToplevel(cwd);
  if (root) {
    name = path.basename(root);
  } else {
    try { name = projectInfo(cwd).name; } catch { name = path.basename(cwd); }
  }
  // Sanitize — povol jen [a-zA-Z0-9._-], rest replace na '-'.
  name = String(name || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60);
  if (!name) name = 'unknown';

  cache.set(cwd, name);
  return name;
}

module.exports = { resolveRepoName };
