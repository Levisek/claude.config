// Debug script pro Bug 2 — Luna pozice v Earth detail view
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') console.error('BROWSER ERR:', msg.text());
});

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('Loaded, waiting 14s for intro animation...');
await page.waitForTimeout(14000);

await page.waitForFunction(() => !!window.__dotsAudit, { timeout: 10000 });

// Enter Earth detail
await page.evaluate(() => window.__dotsAudit.enter('earth'));
await page.waitForTimeout(1500);

const state = await page.evaluate(() => window.__dotsAudit.state());
console.log('State:', state, 'Focus:', await page.evaluate(() => window.__dotsAudit.focusId()));

// Debug pozic
const analysis = await page.evaluate(() => {
  const debug = window.__debug;
  if (!debug) return { error: 'no __debug' };

  const earthAnchor = debug.anchors['earth'];
  const lunaAnchor = debug.moonAnchors['luna'];

  if (!earthAnchor || !lunaAnchor) return { error: 'anchors missing' };

  const ep = earthAnchor.position;
  const lp = lunaAnchor.position;

  const lunaWorldPos = lunaAnchor.matrixWorld.elements;

  return {
    earthLocalPos: { x: ep.x, y: ep.y, z: ep.z },
    earthRotation: { x: earthAnchor.rotation.x, y: earthAnchor.rotation.y, z: earthAnchor.rotation.z },
    lunaLocalPos: { x: lp.x, y: lp.y, z: lp.z },
    lunaLocalPosMagnitude: Math.sqrt(lp.x * lp.x + lp.y * lp.y + lp.z * lp.z),
    // matrixWorld columns 3 = translation (col-major: [12,13,14])
    lunaWorldTranslation: {
      x: lunaWorldPos[12],
      y: lunaWorldPos[13],
      z: lunaWorldPos[14],
    },
    earthMatrixWorldTranslation: {
      x: earthAnchor.matrixWorld.elements[12],
      y: earthAnchor.matrixWorld.elements[13],
      z: earthAnchor.matrixWorld.elements[14],
    },
    lunaParentIsEarth: lunaAnchor.parent === earthAnchor,
    lunaParentUuid: lunaAnchor.parent ? lunaAnchor.parent.uuid.slice(0, 8) : 'none',
    earthUuid: earthAnchor.uuid.slice(0, 8),
  };
});

console.log('\n=== Earth/Luna Analysis ===');
console.log(JSON.stringify(analysis, null, 2));

// Screenshot Earth detail
await page.screenshot({ path: '/c/Users/admin/.claude/skills/visual-audit/scripts/.audit/debug-earth-detail.png' });

await browser.close();
console.log('Done.');
