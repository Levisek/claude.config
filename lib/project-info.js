// Detekce typu projektu podle obsahu cwd. Per-process cache.

const fs = require('fs');
const path = require('path');

let cached = null;

function detect(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  const indexHtml = path.join(cwd, 'index.html');
  const gralMd = path.join(cwd, 'GRAL.md');

  const hasTsconfig = fs.existsSync(tsconfigPath);

  let pkg = null;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {}

  let name = path.basename(cwd);
  let type = 'none';
  let language = hasTsconfig ? 'TypeScript' : 'JavaScript';
  let isMonorepo = false;

  if (pkg) {
    name = pkg.name || name;
    isMonorepo = !!pkg.workspaces;
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps['next']) type = 'Next.js';
    else if (deps['electron']) type = 'Electron';
    else if (deps['expo']) type = 'Expo';
    else if (deps['react-native']) type = 'React Native';
    else if (deps['vite']) type = 'Vite';
    else if (deps['react']) type = 'React';
    else if (deps['vue']) type = 'Vue';
    else if (deps['svelte']) type = 'Svelte';
    else type = 'Node';
  } else if (fs.existsSync(gralMd)) {
    type = 'GRAL';
  } else if (fs.existsSync(indexHtml)) {
    type = 'Vanilla web';
  }

  if (!hasTsconfig && pkg) language = 'JavaScript';

  return { name, type, language, isMonorepo, hasTsconfig, hasPackageJson: !!pkg };
}

function projectInfo(cwd = process.cwd()) {
  if (cached && cached.cwd === cwd) return cached.data;
  const data = detect(cwd);
  cached = { cwd, data };
  return data;
}

module.exports = { projectInfo };
