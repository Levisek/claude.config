#!/usr/bin/env node
/**
 * Visual Audit Runner
 * Použití:
 *   node run.mjs <cíl> [--out VISUAL-AUDIT.md]
 * Cíle:
 *   http(s)://...          → chromium na URL
 *   localhost:xxxx         → chromium na localhost
 *   file:/path/index.html  → chromium file://
 *   electron:/path         → _electron.launch({ args: [path] })
 *   auto                   → detekce z cwd
 */

import { chromium, _electron } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '..');

// ───────────────────────────────────────────────────────────
// Parse argumenty
// ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let target = args[0] || 'auto';
let outFile = 'VISUAL-AUDIT.md';
let projectRoot = process.cwd();
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--out') outFile = args[++i];
  if (args[i] === '--project') projectRoot = path.resolve(args[++i]);
}

// ───────────────────────────────────────────────────────────
// Auto-detekce cíle
// ───────────────────────────────────────────────────────────
function detectTarget(root) {
  const pkgPath = path.join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.electron && pkg.main) return `electron:${root}`;
  }
  const indexHtml = path.join(root, 'index.html');
  if (existsSync(indexHtml)) return `file://${indexHtml.replace(/\\/g, '/')}`;
  return null;
}

if (target === 'auto') {
  const detected = detectTarget(projectRoot);
  if (!detected) {
    console.error('❌ Nepodařilo se auto-detekovat cíl. Zadej explicitně.');
    process.exit(2);
  }
  target = detected;
  console.log(`ℹ  Auto-detekováno: ${target}`);
}

// ───────────────────────────────────────────────────────────
// Viewporty
// ───────────────────────────────────────────────────────────
const VIEWPORTS = [
  { name: 'mobile',  width: 375,  height: 812  },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1440, height: 900  },
];

// ───────────────────────────────────────────────────────────
// Výstupní složky
// ───────────────────────────────────────────────────────────
const auditDir = path.join(projectRoot, '.audit');
const ssDir = path.join(auditDir, 'screenshots');
await fs.mkdir(ssDir, { recursive: true });

// ───────────────────────────────────────────────────────────
// Nálezy
// ───────────────────────────────────────────────────────────
const findings = [];

function add(finding) {
  findings.push({
    id: finding.id,
    severity: finding.severity, // kritik | upozorneni | info
    category: finding.category,
    title: finding.title,
    where: finding.where || '',
    detail: finding.detail || '',
    fix: finding.fix || '',
    screenshot: finding.screenshot || '',
    viewport: finding.viewport || '',
  });
}

// Severity mapa axe → naše
const AXE_SEVERITY = {
  critical: 'kritik',
  serious: 'kritik',
  moderate: 'upozorneni',
  minor: 'info',
};

// ───────────────────────────────────────────────────────────
// Běh: Web (URL / file://)
// ───────────────────────────────────────────────────────────
async function runWeb(url) {
  console.log(`🌐 Web mode: ${url}`);
  const browser = await chromium.launch();
  const okRules = new Set();
  const consoleErrors = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ viewport: vp.name, type: msg.type(), text: msg.text() });
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push({ viewport: vp.name, type: 'pageerror', text: err.message });
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.warn(`⚠  ${vp.name}: načtení selhalo — ${e.message}`);
      await ctx.close();
      continue;
    }

    // Baseline screenshot
    const ssPath = path.join(ssDir, `baseline_${vp.name}.png`);
    await page.screenshot({ path: ssPath, fullPage: true });

    // ───── Axe-core ─────
    try {
      const axeResults = await new AxeBuilder({ page }).analyze();
      for (const v of axeResults.violations) {
        const sev = AXE_SEVERITY[v.impact] || 'upozorneni';
        const target0 = v.nodes[0]?.target?.join(' ') || '';
        const html0 = (v.nodes[0]?.html || '').slice(0, 140);
        add({
          id: `AXE-${v.id}`,
          severity: sev,
          category: v.tags.includes('wcag2aa') ? 'a11y' : 'kvalita',
          title: v.help,
          where: target0,
          detail: html0,
          fix: v.helpUrl,
          viewport: vp.name,
        });
      }
      for (const p of axeResults.passes) okRules.add(`AXE-${p.id}`);
    } catch (e) {
      console.warn(`⚠  axe-core selhalo na ${vp.name}: ${e.message}`);
    }

    // ───── Custom: horizontal scroll ─────
    const hScroll = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      viewWidth: window.innerWidth,
    }));
    if (hScroll.docWidth > hScroll.viewWidth + 1) {
      add({
        id: vp.name === 'mobile' ? 'V040' : (vp.name === 'desktop' ? 'V041' : 'V041b'),
        severity: 'kritik',
        category: 'responsive',
        title: `Horizontální scroll na ${vp.name} (${hScroll.docWidth}px > ${hScroll.viewWidth}px)`,
        detail: `Stránka překračuje viewport o ${hScroll.docWidth - hScroll.viewWidth}px.`,
        fix: 'Najdi přesahující element (DevTools → Elements → computed width). Nepoužívej jen overflow:hidden — najdi zdroj.',
        viewport: vp.name,
      });
    } else {
      okRules.add(vp.name === 'mobile' ? 'V040' : 'V041');
    }

    // ───── Custom: img bez width/height ─────
    const imgsNoSize = await page.$$eval('img', (imgs) =>
      imgs
        .filter((i) => !i.hasAttribute('width') || !i.hasAttribute('height'))
        .map((i) => ({ src: i.getAttribute('src') || '(inline)', alt: i.getAttribute('alt') || '' }))
        .slice(0, 10)
    );
    if (imgsNoSize.length) {
      add({
        id: 'V044',
        severity: 'kritik',
        category: 'responsive',
        title: `${imgsNoSize.length}× <img> bez width/height (CLS)`,
        detail: imgsNoSize.map((i) => `- ${i.src}`).join('\n'),
        fix: 'Doplň atributy width + height na každý <img>. Zabraňuje layout shiftu.',
        viewport: vp.name,
      });
    } else {
      okRules.add('V044');
    }

    // ───── Custom: touch targety < 44×44 (jen mobile) ─────
    if (vp.name === 'mobile') {
      const smallTargets = await page.$$eval(
        'a, button, [role="button"], input[type="button"], input[type="submit"]',
        (els) =>
          els
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { tag: el.tagName.toLowerCase(), w: r.width, h: r.height, text: (el.textContent || '').trim().slice(0, 40) };
            })
            .filter((t) => (t.w > 0 && t.h > 0) && (t.w < 44 || t.h < 44))
            .slice(0, 10)
      );
      if (smallTargets.length) {
        add({
          id: 'V009',
          severity: 'kritik',
          category: 'a11y',
          title: `${smallTargets.length}× touch target < 44×44 px`,
          detail: smallTargets.map((t) => `- <${t.tag}> ${t.w.toFixed(0)}×${t.h.toFixed(0)} "${t.text}"`).join('\n'),
          fix: 'Padding / min-width / min-height. Ikony v kruhu: 44×44 wrapper.',
          viewport: vp.name,
        });
      } else {
        okRules.add('V009');
      }
    }

    // ───── Custom: <html lang> ─────
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    if (!htmlLang || htmlLang.trim() === '') {
      add({
        id: 'V008',
        severity: 'kritik',
        category: 'a11y',
        title: 'Chybí <html lang="…">',
        fix: '<html lang="cs"> (nebo podle jazyka obsahu).',
        viewport: vp.name,
      });
    } else {
      okRules.add('V008');
    }

    // ───── Custom: h1 count ─────
    const h1Count = await page.$$eval('h1', (els) => els.length);
    if (h1Count !== 1) {
      add({
        id: 'V002',
        severity: h1Count === 0 ? 'kritik' : 'upozorneni',
        category: 'a11y',
        title: `${h1Count}× <h1> na stránce (očekáváno 1)`,
        fix: h1Count === 0 ? 'Přidej h1 do hero/main.' : 'Ponech jen jeden h1, ostatní přepni na h2/.sr-only.',
        viewport: vp.name,
      });
    } else {
      okRules.add('V002');
    }

    await ctx.close();
  }

  // Console errors jako nálezy
  if (consoleErrors.length) {
    add({
      id: 'V084',
      severity: 'upozorneni',
      category: 'stavy',
      title: `${consoleErrors.length}× console error/warn`,
      detail: consoleErrors.slice(0, 8).map((e) => `[${e.viewport}] ${e.type}: ${e.text}`).join('\n'),
      fix: 'Odstraň debug log. Reálné errory → error boundary / sentry.',
    });
  } else {
    okRules.add('V084');
  }

  await browser.close();
  return { okRules: [...okRules], consoleErrors };
}

// ───────────────────────────────────────────────────────────
// Běh: Electron
// ───────────────────────────────────────────────────────────
async function waitForCDP(port, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
          resolve(res.statusCode === 200);
          res.resume();
        });
        req.on('error', () => resolve(false));
        req.setTimeout(500, () => { req.destroy(); resolve(false); });
      });
      if (ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function runElectron(appPath) {
  console.log(`📦 Electron mode: ${appPath} (CDP connect)`);
  const okRules = new Set();
  const cspViolations = [];
  const consoleErrors = [];

  // Ověř že main existuje
  const pkgPath = path.join(appPath, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const mainRel = pkg.main || 'index.js';
  const mainAbs = path.join(appPath, mainRel);
  if (!existsSync(mainAbs)) {
    throw new Error(`Main entry neexistuje: ${mainAbs}. Pravděpodobně chybí build (tsc). Spusť 'npx tsc' v projektu.`);
  }

  // Electron binary
  const platformBin = {
    win32:  'node_modules/electron/dist/electron.exe',
    darwin: 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    linux:  'node_modules/electron/dist/electron',
  }[process.platform];
  const electronBin = platformBin ? path.join(appPath, platformBin) : null;
  if (!electronBin || !existsSync(electronBin)) {
    throw new Error(`Electron binary nenalezen: ${electronBin}. Spusť 'npm install' v ${appPath}.`);
  }

  // ───── Spusť Electron s CDP portem (žádný --inspect, takže LevisIDE se nerozbije) ─────
  const CDP_PORT = 9222 + Math.floor(Math.random() * 1000);
  const args = [appPath, `--remote-debugging-port=${CDP_PORT}`, '--remote-allow-origins=*'];
  console.log(`   spouštím: electron.exe ${args.join(' ')}`);
  const child = spawn(electronBin, args, { cwd: appPath, stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (b) => {
    const s = b.toString();
    if (s.includes('[AUDIT-DBG]') || s.includes('LevisIDE started')) process.stdout.write(`[MAIN]  ${s}`);
  });
  child.stderr.on('data', (b) => {
    const s = b.toString();
    if (s.includes('ERROR') && !s.includes('gpu_disk_cache') && !s.includes('Unable to move')) {
      process.stderr.write(`[MAIN!] ${s}`);
    }
  });
  child.on('exit', (code) => {
    console.log(`   main proces exit: ${code}`);
  });

  // Počkej na CDP endpoint
  const cdpOk = await waitForCDP(CDP_PORT, 30000);
  if (!cdpOk) {
    try { child.kill(); } catch {}
    throw new Error(`CDP neodpovídá na :${CDP_PORT} do 30s. Aplikace pravděpodobně nestartuje.`);
  }
  console.log(`   CDP ready na portu ${CDP_PORT}`);
  // Ještě dej rendereru čas načíst se
  await new Promise((r) => setTimeout(r, 2500));

  // ───── Connect Playwright přes CDP ─────
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const contexts = browser.contexts();
  const allPages = contexts.flatMap((c) => c.pages());

  if (allPages.length === 0) {
    try { child.kill(); } catch {}
    throw new Error('Electron nemá žádné renderer stránky. Okno se pravděpodobně nevytvořilo.');
  }
  const window = allPages[0];
  console.log(`   Renderer pages: ${allPages.length}`);

  window.on('pageerror', (err) => consoleErrors.push({ type: 'pageerror', text: err.message }));
  window.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Content Security Policy') || text.includes('CSP')) cspViolations.push(text);
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text });
    }
  });

  // ───── Multi-window screenshots ─────
  const allWindows = allPages;
  for (let i = 0; i < allWindows.length; i++) {
    const w = allWindows[i];
    try {
      const title = await w.title();
      await w.screenshot({ path: path.join(ssDir, `electron_window_${i}_${title.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.png`) });
    } catch {}
  }

  // ───── Axe-core (legacy mode — CDP connect nepodporuje newPage) ─────
  try {
    const axeResults = await new AxeBuilder({ page: window }).setLegacyMode(true).analyze();
    for (const v of axeResults.violations) {
      const sev = AXE_SEVERITY[v.impact] || 'upozorneni';
      const target0 = v.nodes[0]?.target?.join(' ') || '';
      const html0 = (v.nodes[0]?.html || '').slice(0, 140);
      add({
        id: `AXE-${v.id}`,
        severity: sev,
        category: v.tags.includes('wcag2aa') ? 'a11y' : 'kvalita',
        title: v.help,
        where: target0,
        detail: html0,
        fix: v.helpUrl,
      });
    }
    for (const p of axeResults.passes) okRules.add(`AXE-${p.id}`);
  } catch (e) {
    console.warn(`⚠  axe-core selhalo: ${e.message}`);
  }

  // ───── Custom: html lang, h1 ─────
  const meta = await window.evaluate(() => ({
    lang: document.documentElement.lang,
    h1: document.querySelectorAll('h1').length,
    imgsNoSize: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('width') || !i.hasAttribute('height')).length,
    title: document.title,
  }));
  if (!meta.lang) {
    add({ id: 'V008', severity: 'kritik', category: 'a11y', title: 'Chybí <html lang>', fix: '<html lang="cs">' });
  } else okRules.add('V008');
  if (meta.h1 !== 1) {
    add({ id: 'V002', severity: meta.h1 === 0 ? 'kritik' : 'upozorneni', category: 'a11y', title: `${meta.h1}× <h1>` });
  } else okRules.add('V002');
  if (meta.imgsNoSize > 0) {
    add({ id: 'V044', severity: 'kritik', category: 'responsive', title: `${meta.imgsNoSize}× <img> bez width/height`, fix: 'Doplň width/height pro CLS.' });
  } else okRules.add('V044');

  // ───── Custom: zoom levels (přes CDP Emulation) ─────
  const client = await window.context().newCDPSession(window);
  for (const zoom of [1.0, 1.25, 1.5]) {
    try {
      await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom });
      await new Promise((r) => setTimeout(r, 400));
      await window.screenshot({ path: path.join(ssDir, `electron_zoom_${String(zoom).replace('.', '_')}.png`) });
    } catch (e) {
      console.warn(`⚠  zoom ${zoom} selhalo: ${e.message}`);
    }
  }
  try { await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); } catch {}

  // ───── Theme switch (přes Playwright emulateMedia — CDP pod kapotou) ─────
  try {
    await window.emulateMedia({ colorScheme: 'dark' });
    await new Promise((r) => setTimeout(r, 500));
    await window.screenshot({ path: path.join(ssDir, 'electron_theme_dark.png') });
    await window.emulateMedia({ colorScheme: 'light' });
    await new Promise((r) => setTimeout(r, 500));
    await window.screenshot({ path: path.join(ssDir, 'electron_theme_light.png') });
    okRules.add('E080');
  } catch (e) {
    console.warn(`⚠  theme switch selhalo: ${e.message}`);
  }

  // ───── Custom: CSP violations ─────
  if (cspViolations.length) {
    add({
      id: 'E001',
      severity: 'kritik',
      category: 'electron-security',
      title: `${cspViolations.length}× CSP violation`,
      detail: cspViolations.slice(0, 5).join('\n'),
      fix: 'Oprav CSP meta tag nebo session.defaultSession.webRequest.onHeadersReceived.',
    });
  } else {
    okRules.add('E001');
  }

  // ───── Console errors ─────
  if (consoleErrors.length) {
    add({
      id: 'V084',
      severity: 'upozorneni',
      category: 'stavy',
      title: `${consoleErrors.length}× console error/warn`,
      detail: consoleErrors.slice(0, 8).map((e) => `${e.type}: ${e.text}`).join('\n'),
      fix: 'Odstraň debug log. Reálné errory → error boundary / elektron-log.',
    });
  } else {
    okRules.add('V084');
  }

  try { await browser.close(); } catch {}
  try { child.kill(); } catch {}
  // Windows potřebuje chvíli na cleanup child procesu
  await new Promise((r) => setTimeout(r, 500));
  return { okRules: [...okRules], consoleErrors, cspViolations, windows: allWindows.length };
}

// ───────────────────────────────────────────────────────────
// Router
// ───────────────────────────────────────────────────────────
let extras = { okRules: [], consoleErrors: [], windows: 0, cspViolations: [] };
let mode = 'web';
if (target.startsWith('electron:')) {
  mode = 'electron';
  const appPath = target.slice('electron:'.length);
  extras = await runElectron(appPath);
} else if (target.startsWith('http') || target.startsWith('file:') || target.startsWith('localhost')) {
  const url = target.startsWith('localhost') ? `http://${target}` : target;
  extras = await runWeb(url);
} else {
  console.error(`❌ Neznámý formát cíle: ${target}`);
  process.exit(2);
}

// ───────────────────────────────────────────────────────────
// Git metadata
// ───────────────────────────────────────────────────────────
function gitMeta(root) {
  try {
    const cwd = root;
    const sha = execSync('git rev-parse --short HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return { sha, branch, dirty };
  } catch {
    return { sha: 'n/a', branch: 'n/a', dirty: false };
  }
}
const git = gitMeta(projectRoot);

// ───────────────────────────────────────────────────────────
// Report
// ───────────────────────────────────────────────────────────
const crit = findings.filter((f) => f.severity === 'kritik');
const warn = findings.filter((f) => f.severity === 'upozorneni');
const info = findings.filter((f) => f.severity === 'info');

const pkgName = (() => {
  try {
    return JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')).name;
  } catch { return path.basename(projectRoot); }
})();

const timestamp = new Date().toISOString();

function findingBlock(f) {
  return `### ${f.id} · ${f.title}

${f.where ? `**Kde:** \`${f.where}\`  \n` : ''}${f.viewport ? `**Viewport:** ${f.viewport}  \n` : ''}${f.detail ? `**Detail:**\n\`\`\`\n${f.detail}\n\`\`\`\n` : ''}${f.fix ? `**Fix:** ${f.fix}\n` : ''}${f.screenshot ? `\n![](${f.screenshot})\n` : ''}`;
}

const md = `# VISUAL-AUDIT — ${pkgName}

> Runtime vizuální audit · ${timestamp.slice(0, 19).replace('T', ' ')} · git \`${git.sha}\`${git.dirty ? ' (dirty)' : ''} · mode \`${mode}\`

---

## 0. SOUHRN

\`\`\`
╭─ severity ──────────────────────────────────╮
│  🔴 ${String(crit.length).padStart(2)} kritik                               │
│  🟡 ${String(warn.length).padStart(2)} upozornění                           │
│  🟢 ${String(extras.okRules.length).padStart(2)} prošlo                               │
│                                             │
│  zábrana releasu: ${crit.length > 0 ? 'ANO' : 'ne '}                       │
╰─────────────────────────────────────────────╯

╭─ pokrytí ───────────────────────────────────╮
│  mode:       ${mode.padEnd(33)}│
│  viewporty:  ${mode === 'web' ? '375, 768, 1440' : 'n/a (Electron window size)'}${' '.repeat(Math.max(0, 33 - (mode === 'web' ? 14 : 26)))}│
│  windows:    ${String(extras.windows || 0).padEnd(33)}│
│  csp viol:   ${String(extras.cspViolations?.length || 0).padEnd(33)}│
│  console:    ${String(extras.consoleErrors?.length || 0).padEnd(33)}│
╰─────────────────────────────────────────────╯
\`\`\`

---

## 1. 🔴 KRITICKÉ (${crit.length})

${crit.length === 0 ? '_Žádné kritické nálezy._' : crit.map(findingBlock).join('\n---\n\n')}

---

## 2. 🟡 UPOZORNĚNÍ (${warn.length})

${warn.length === 0 ? '_Žádná upozornění._' : warn.map(findingBlock).join('\n---\n\n')}

${info.length > 0 ? `---

## 3. ℹ INFO (${info.length})

${info.map(findingBlock).join('\n---\n\n')}
` : ''}

---

## 4. 🟢 PROŠLO (${extras.okRules.length})

<details><summary>Rozbal seznam</summary>

${extras.okRules.sort().map((r) => `- \`${r}\``).join('\n')}

</details>

---

## 5. METADATA

\`\`\`yaml
timestamp: ${timestamp}
git_sha: ${git.sha}
git_branch: ${git.branch}
git_dirty: ${git.dirty}
mode: ${mode}
target: ${target}
project_root: ${projectRoot.replace(/\\/g, '/')}
playwright: 1.59.1
checklist_version: 0.1.0
\`\`\`

---

*Generováno \`/visual-audit\` · Claude Code · screenshoty v \`.audit/screenshots/\`*
`;

const outPath = path.join(projectRoot, outFile);
await fs.writeFile(outPath, md, 'utf-8');

// Meta JSON
await fs.writeFile(path.join(auditDir, 'meta.json'), JSON.stringify({
  timestamp, git, mode, target, projectRoot,
  findings: { kritik: crit.length, upozorneni: warn.length, info: info.length, ok: extras.okRules.length },
  windows: extras.windows || 0,
  cspViolations: extras.cspViolations?.length || 0,
  consoleErrors: extras.consoleErrors?.length || 0,
}, null, 2), 'utf-8');

console.log('');
console.log(`✅ Audit hotový.`);
console.log(`   🔴 ${crit.length} kritik · 🟡 ${warn.length} upozornění · 🟢 ${extras.okRules.length} prošlo`);
console.log(`   📄 ${outPath}`);
console.log(`   🖼  ${ssDir}`);
