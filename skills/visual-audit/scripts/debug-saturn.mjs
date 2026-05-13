// Debug script pro Bug 1 — Saturn ring v detail view
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// collect console
page.on('console', msg => {
  if (msg.type() === 'error') console.error('BROWSER ERR:', msg.text());
});

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('Loaded, waiting 14s for intro animation...');
await page.waitForTimeout(14000);

await page.waitForFunction(() => !!window.__dotsAudit, { timeout: 10000 });

// Expose pool na window z main.js — check
const hasPool = await page.evaluate(() => !!window.__pool);
console.log('window.__pool exposed:', hasPool);

// Enter Saturn detail
await page.evaluate(() => window.__dotsAudit.enter('saturn'));
await page.waitForTimeout(2000);

const state = await page.evaluate(() => window.__dotsAudit.state());
const focus = await page.evaluate(() => window.__dotsAudit.focusId());
console.log('State:', state, 'Focus:', focus);

// Analyze pool particles pro Saturn
const analysis = await page.evaluate(() => {
  const pool = window.__pool;
  if (!pool) return { error: 'window.__pool not exposed' };

  // Saturn je planet index 6 (PLANETS[6])
  const SATURN_OWNER = 6;
  const ON_RING = 5;
  const ON_PLANET = 4;
  const ON_MOON = 6;
  const FLYING = 2;
  const IDLE = 0;

  let ringCount = 0;
  let planetCount = 0;
  let flyingCount = 0;
  let idleCount = 0;
  let ringAlphaSum = 0;
  let ringOwnerAlphaSum = 0;
  let ringVisible = 0;
  const ringSample = [];

  for (let i = 0; i < pool.count; i++) {
    if (pool.owner[i] !== SATURN_OWNER) continue;
    const ph = pool.phase[i];
    if (ph === ON_RING) {
      ringCount++;
      const a = pool.alpha[i];
      const oa = pool.ownerAlpha[i];
      const sz = pool.size[i];
      ringAlphaSum += a;
      ringOwnerAlphaSum += oa;
      if (a * oa > 0.01) ringVisible++;
      if (ringSample.length < 5) {
        ringSample.push({
          alpha: a,
          ownerAlpha: oa,
          size: sz,
          pos: [
            pool.position[3*i].toFixed(1),
            pool.position[3*i+1].toFixed(1),
            pool.position[3*i+2].toFixed(1),
          ],
          ownerAlphaMul: pool.ownerAlphaMul[SATURN_OWNER],
        });
      }
    } else if (ph === ON_PLANET) {
      planetCount++;
    } else if (ph === FLYING) {
      flyingCount++;
    } else if (ph === IDLE) {
      idleCount++;
    }
  }

  return {
    saturnOwnerIdx: SATURN_OWNER,
    ownerAlphaMul: pool.ownerAlphaMul[SATURN_OWNER],
    ringCount,
    planetCount,
    flyingCount,
    ringAvgAlpha: ringCount ? (ringAlphaSum / ringCount).toFixed(3) : 'N/A',
    ringAvgOwnerAlpha: ringCount ? (ringOwnerAlphaSum / ringCount).toFixed(3) : 'N/A',
    ringVisible,
    ringSample,
  };
});

console.log('\n=== Saturn Pool Analysis ===');
console.log(JSON.stringify(analysis, null, 2));

// Screenshot z různých úhlů
await page.screenshot({ path: '/c/Users/admin/.claude/skills/visual-audit/scripts/.audit/debug-saturn-front.png' });

// Rotace kamery (OrbitControls) — přes mouse drag simulation
// Drag dolů pro pohled z boku
await page.mouse.move(720, 450);
await page.mouse.down();
await page.mouse.move(720, 350, { steps: 30 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: '/c/Users/admin/.claude/skills/visual-audit/scripts/.audit/debug-saturn-top.png' });

// Drag pro pohled ze strany
await page.mouse.move(720, 450);
await page.mouse.down();
await page.mouse.move(900, 450, { steps: 30 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: '/c/Users/admin/.claude/skills/visual-audit/scripts/.audit/debug-saturn-side.png' });

await browser.close();
console.log('\nScreenshots saved to .audit/');
