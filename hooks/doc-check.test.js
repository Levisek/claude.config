// Testy doc-check hooku. Hook se řídí stdin JSONem a stavem na disku, takže
// se testuje end-to-end přes execFileSync — ne extrakcí funkcí ze zdrojáku.
// (Extrakce regexem tady už jednou selhala na CRLF; tudy ne.)
//
// Pouštěj sériově: `node --test --test-concurrency=1 hooks/*.test.js`.
// Testy hooků sdílejí stav pod ~/.claude (cache, session-log), takže při
// paralelním běhu si navzájem přepisují půdu pod nohama.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOK = path.join(__dirname, 'doc-check.js');
const STATE = path.join(os.homedir(), '.claude', 'cache', 'doc-check-state.json');

function runHook(payload, env = {}) {
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return out.trim();
}

// Umístění sandboxu má dvě tvrdá omezení:
//  1. NE pod os.tmpdir() — na Windows je to ...\AppData\Local\Temp, což hook
//     záměrně přeskakuje, takže by všechno vracelo prázdno a netestovalo nic.
//  2. NE uvnitř git repa — ~/.claude samo repo je, takže by
//     `git rev-parse --show-toplevel` u testovacích složek vracelo kořen
//     .claude a hook by zkoumal úplně jiný projekt.
// C:\dev obojí splňuje.
const SANDBOX = path.join('C:', 'dev', '.doccheck-test');

// `git: false` je pro případ „tohle není projekt" — složka bez repa i bez
// build markerů. Jinak default `git init`, protože skutečné projekty repo mají.
function tmpProject(name, files, { git = true } = {}) {
  const dir = path.join(SANDBOX, name + '-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  for (const [f, content] of Object.entries(files)) {
    const p = path.join(dir, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  if (git) {
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  }
  return dir;
}

// Vrací jen cestu, složku nezakládá — testy na „vault ještě neexistuje"
// potřebují, aby tam opravdu nic nebylo. Kdo vault chce, mkdir-ne si ho sám.
function tmpVault(name) {
  return path.join(SANDBOX, 'vault-' + name + '-' + Date.now());
}

// Vault, který existuje. Většina testů ho potřebuje: bez něj se osobní projekt
// vydá větví „odlož do repa" a netestuje se nabídka dokumentace.
function tmpVaultReal(name) {
  const dir = tmpVault(name);
  fs.mkdirSync(path.join(dir, '🚀 Projekty'), { recursive: true });
  return dir;
}

function cleanupSandbox() {
  try {
    fs.rmSync(SANDBOX, { recursive: true, force: true });
  } catch {}
}

// Stav se sdílí s reálným cache souborem, tak si ho kolem testů uklidíme.
function withCleanState(fn) {
  const backup = fs.existsSync(STATE) ? fs.readFileSync(STATE, 'utf8') : null;
  try {
    if (backup) fs.unlinkSync(STATE);
    fn();
  } finally {
    if (backup) fs.writeFileSync(STATE, backup);
    else if (fs.existsSync(STATE)) fs.unlinkSync(STATE);
  }
}

test('doc-check', async t => {
  let pass = 0;
  const check = (label, cond) => {
    assert.ok(cond, label);
    console.log('PASS [' + label + ']');
    pass++;
  };

  withCleanState(() => {
    const vault = tmpVaultReal('offer');

    // Projekt s package.json a bez poznámky → hook musí promluvit.
    const proj = tmpProject('real', {
      'package.json': JSON.stringify({ name: 'testovaci-projekt', dependencies: {} }),
    });
    const out = runHook({ source: 'startup', cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: vault });
    check('projekt bez poznámky → nabídne dokumentaci', out.includes('additionalContext'));
    const parsed = JSON.parse(out);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    check('kontext nese jméno projektu', ctx.includes('testovaci-projekt'));
    check('kontext hlásí scope', ctx.includes('(personal)'));
    check('kontext hlásí, že v repu není dokumentace', ctx.includes('žádná'));
    check('kontext odkazuje na skill obsidian-docs', ctx.includes('obsidian-docs'));
  });

  withCleanState(() => {
    const vault = tmpVaultReal('withdocs');

    // README v repu se má propsat do kontextu jako podklad.
    const proj = tmpProject('withdocs', {
      'package.json': JSON.stringify({ name: 'projekt-s-readme' }),
      'README.md': '# Projekt\n\nNějaký popis, který má nenulovou velikost.\n',
    });
    const ctx = JSON.parse(
      runHook({ source: 'startup', cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: vault })
    ).hookSpecificOutput.additionalContext;
    check('README se propíše do kontextu', ctx.includes('README.md'));
    check('nabídne převod existující dokumentace', ctx.includes('převést existující'));
  });

  withCleanState(() => {
    // Pracovní projekt (leží pod WORK_ROOT) míří do pracovního vaultu, i když
    // ten osobní zrovna existuje. Vaulty se nesmí prolnout.
    const workVault = tmpVault('work-missing');
    const personalVault = tmpVaultReal('personal-present');
    const proj = tmpProject('worky', { 'package.json': '{"name":"pracovni"}' });

    const ctx = JSON.parse(
      runHook(
        { source: 'startup', cwd: proj },
        {
          CLAUDE_WORK_ROOT: SANDBOX,
          CLAUDE_OBSIDIAN_VAULT_WORK: workVault,
          CLAUDE_OBSIDIAN_VAULT: personalVault,
        }
      )
    ).hookSpecificOutput.additionalContext;
    check('pracovní projekt hlásí scope work', ctx.includes('(work)'));
    check('pracovní projekt míří do pracovního vaultu', ctx.includes(path.basename(workVault)));
    check('chybějící vault se ohlásí', ctx.includes('zatím neexistuje'));
    check('osobní vault se nepoužije', !ctx.includes(path.basename(personalVault)));
  });

  withCleanState(() => {
    // Osobní projekt na stroji bez osobního vaultu → poznámka se nepíše,
    // odloží se do repa. Tohle je celý smysl work/personal splitu.
    const missing = tmpVault('missing');
    const proj = tmpProject('deferred', { 'package.json': '{"name":"osobni-projekt"}' });
    const marker = path.join(proj, '.claude', 'doc-pending.md');

    const ctx = JSON.parse(
      runHook({ source: 'startup', cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: missing })
    ).hookSpecificOutput.additionalContext;
    check('odložení se ohlásí', ctx.includes('odložena'));
    check('marker v repu vznikne', fs.existsSync(marker));

    const body = fs.readFileSync(marker, 'utf8');
    check('marker má frontmatter', body.startsWith('---\ndoc-pending: true'));
    check('marker nese jméno projektu', body.includes('osobni-projekt'));

    // Podruhé už nemá co dodat — marker leží v repu, hook drží hubu.
    check(
      'podruhé → ticho (nespamuje každý start)',
      runHook({ source: 'startup', cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: missing }) === ''
    );

    // Doma: osobní vault je po ruce a marker z práce čeká na zpracování.
    const homeVault = tmpVaultReal('home');
    const homeCtx = JSON.parse(
      runHook({ source: 'startup', cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: homeVault })
    ).hookSpecificOutput.additionalContext;
    check('doma se odložený marker připomene', homeCtx.includes('odložený z jiného stroje'));
    check('doma se odkáže na obsah markeru', homeCtx.includes('doc-pending.md'));
    check('doma se nabídne zápis', homeCtx.includes('obsidian-docs'));
  });

  withCleanState(() => {
    const emptyVault = tmpVault('none3');

    // Ne-startup zdroje musí mlčet.
    const proj = tmpProject('resume', { 'package.json': '{"name":"x"}' });
    for (const source of ['resume', 'compact', 'clear']) {
      const out = runHook({ source, cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: emptyVault });
      check('source=' + source + ' → ticho', out === '');
    }
  });

  withCleanState(() => {
    const emptyVault = tmpVault('none4');

    // Holá složka bez repa i bez build markerů není projekt.
    const notProj = tmpProject('bare', { 'poznamka.txt': 'nic' }, { git: false });
    check(
      'složka bez projektových markerů → ticho',
      runHook({ source: 'startup', cwd: notProj }, { CLAUDE_OBSIDIAN_VAULT: emptyVault }) === ''
    );
  });

  withCleanState(() => {
    const emptyVault = tmpVault('none5');

    // Odmítnutí se musí respektovat.
    const proj = tmpProject('declined', { 'package.json': '{"name":"odmitnuty"}' });
    execFileSync('node', [path.join(__dirname, '..', 'scripts', 'doc-state.js'), '--skip', proj], {
      encoding: 'utf8',
    });
    check(
      'po --skip → ticho',
      runHook({ source: 'startup', cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: emptyVault }) === ''
    );
  });

  withCleanState(() => {
    const emptyVault = tmpVault('none6');

    // Projekt s vlastním Obsidian vaultem si dokumentaci řeší sám.
    const own = tmpProject('ownvault', {
      'package.json': '{"name":"s-vlastnim-vaultem"}',
      'docs/vault/.obsidian/app.json': '{}',
    });
    check(
      'projekt s vlastním vaultem → ticho',
      runHook({ source: 'startup', cwd: own }, { CLAUDE_OBSIDIAN_VAULT: emptyVault }) === ''
    );

    // README.md nesmí projít dvakrát kvůli case-insensitive FS na Windows.
    const dupVault = tmpVaultReal('dup');
    const dup = tmpProject('dup', {
      'package.json': '{"name":"dedup"}',
      'README.md': '# Něco\n',
    });
    const ctxDup = JSON.parse(
      runHook({ source: 'startup', cwd: dup }, { CLAUDE_OBSIDIAN_VAULT: dupVault })
    ).hookSpecificOutput.additionalContext;
    check('README se v seznamu objeví jen jednou', (ctxDup.match(/README\.md/gi) || []).length === 1);
  });

  withCleanState(() => {
    // Existující poznámka ve vaultu → ticho, i když stav ještě nic neví.
    const vaultDir = tmpVault('noted');
    fs.mkdirSync(path.join(vaultDir, '🚀 Projekty'), { recursive: true });
    fs.writeFileSync(path.join(vaultDir, '🚀 Projekty', '🧩 Muj Projekt.md'), '# Muj Projekt\n');

    const proj = tmpProject('noted', { 'package.json': JSON.stringify({ name: 'muj-projekt' }) });
    check(
      'poznámka ve vaultu (jiný emoji i pomlčky) → ticho',
      runHook({ source: 'startup', cwd: proj }, { CLAUDE_OBSIDIAN_VAULT: vaultDir }) === ''
    );
  });

  cleanupSandbox();
  console.log('\nVšech ' + pass + ' doc-check případů prošlo');
});
