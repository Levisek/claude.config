// Per-body visual audit — projede všechny 9 planet + 19 moonů v detail view.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const OUT_DIR = path.resolve('.audit/bodies');
await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Sbírat console errory/warny
const consoleIssues = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleIssues.push(`ERR: ${msg.text()}`);
  else if (msg.type() === 'warning' && !msg.text().includes('GPU stall')) {
    consoleIssues.push(`WARN: ${msg.text()}`);
  }
});
page.on('pageerror', (e) => consoleIssues.push(`PAGEERR: ${e.message}`));

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('  page loaded, waiting 14s for intro animation...');
await page.waitForTimeout(14000);

await page.waitForFunction(() => !!window.__dotsAudit, { timeout: 10000 });
const planetIds = await page.evaluate(() => window.__dotsAudit.planets);
const moonIds = await page.evaluate(() => window.__dotsAudit.moons);

console.log(`  planets: ${planetIds.join(', ')}`);
console.log(`  moons: ${moonIds.length} — ${moonIds.join(', ')}`);

// Baseline main
await page.screenshot({ path: path.join(OUT_DIR, '00_main.png') });

// Planety (detail pro každou, ESC mezi nimi)
let idx = 1;
for (const id of planetIds) {
  console.log(`  → planet ${id}`);
  await page.evaluate((pid) => window.__dotsAudit.enter(pid), id);
  await page.waitForTimeout(1100); // transition 0.8s + margin
  await page.screenshot({ path: path.join(OUT_DIR, `${String(idx).padStart(2, '0')}_planet_${id}.png`) });
  idx++;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

// Moons (přes picker z planet-detail, ale i přímo přes __dotsAudit.enter)
// V planet-detail je povoleno kliknout na moon. Přímý enter() na moon může fungovat — zkusme.
for (const id of moonIds) {
  console.log(`  → moon ${id}`);
  // Otevřít rodiče nejdřív (takže picker je nastaven na moony rodiče)
  // Jinak enter() na moon z MAIN state nemusí projít
  // Ale API přes __dotsAudit.enter(id) přímo volá detailView.enter()
  await page.evaluate((mid) => window.__dotsAudit.enter(mid), id);
  await page.waitForTimeout(1100);
  const state = await page.evaluate(() => window.__dotsAudit.state());
  const focus = await page.evaluate(() => window.__dotsAudit.focusId());
  await page.screenshot({ path: path.join(OUT_DIR, `${String(idx).padStart(2, '0')}_moon_${id}.png`) });
  console.log(`     state=${state} focus=${focus}`);
  idx++;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

await browser.close();

// Report
await fs.writeFile(path.join(OUT_DIR, 'console-issues.txt'),
  consoleIssues.length ? consoleIssues.join('\n') : '(none)', 'utf-8');

console.log(`\n✅ Audit: ${idx - 1} screenshots, ${consoleIssues.length} console issues`);
console.log(`   → ${OUT_DIR}`);
