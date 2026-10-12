// Screenshot stránky v headless Chromiu s WebGL (SwiftShader) — podklad pro kritika.
//
// node snimky.mjs <url> <vystup.png> [--click selektor | --pause ms]… [--wait ms] [--w px] [--h px] [--eval "js"]
//
// --click (selektor Playwrightu, např. "text=START") a --pause se provedou v zadaném pořadí, pak --eval se spustí po načtení a před čekáním (přepnutí módu, přeskočení intra…).
// Playwright se hledá v PLAYWRIGHT_PATH (cesta k balíčku), jinak běžný import —
// na strojích bez npm stačí ukázat na node_modules/playwright jiného projektu.

const args = process.argv.slice(2);
const [url, out] = args;
if (!url || !out) {
  console.error('použití: node snimky.mjs <url> <vystup.png> [--click sel | --pause ms]… [--wait ms] [--w px] [--h px] [--eval "js"]');
  process.exit(2);
}
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

const pw = process.env.PLAYWRIGHT_PATH
  ? await import(`${process.env.PLAYWRIGHT_PATH}/index.mjs`)
  : await import('playwright');

const browser = await pw.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: { width: Number(opt('w', 1280)), height: Number(opt('h', 720)) },
  });
  const chyby = [];
  page.on('pageerror', (e) => chyby.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--click') await page.click(args[i + 1], { timeout: 30000 });
    if (args[i] === '--pause') await page.waitForTimeout(Number(args[i + 1]));
  }
  const js = opt('eval');
  if (js) await page.evaluate(js);
  await page.waitForTimeout(Number(opt('wait', 8000)));
  await page.screenshot({ path: out });
  if (chyby.length) console.error(`chyby stránky:\n${chyby.join('\n')}`);
  console.log(out);
} finally {
  await browser.close();
}
