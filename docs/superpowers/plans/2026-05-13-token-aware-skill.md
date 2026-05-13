# token-aware skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Snížit spotřebu tokenů adaptivním reasoning effortem + delegací mechanických tasků na levné modely (`haiku`, `sonnet`), s vizuální indikací a loggingem rozhodnutí.

**Architecture:** Jeden user-level skill (`~/.claude/skills/token-aware/SKILL.md`), který Claude invokuje description-matchingem (přirozený jazyk + auto při plánu/specs/implementaci). Skill nese rubriku effortu a modelu agentů, instruuje Claude renderovat status řádek `[ IQ:X │ main:opus │ agenti:… ]` a logovat každé rozhodnutí do `~/.claude/logs/effort-decisions.jsonl`. CLAUDE.md snížen z reasoning_effort 99 na 75 (floor). `/iq` command smazán — nahrazen přirozeným jazykem. Pomocný node skript `effort-stats.js` agreguje log pro pozdější vytříbení rubriky.

**Tech Stack:** Markdown (skill), Node.js (effort-stats utility), git, žádný test framework — `node --test` vestavěný.

**Spec reference:** `docs/superpowers/specs/2026-05-13-token-aware-skill-design.md`

---

## File Structure

```
~/.claude/
├── skills/
│   └── token-aware/
│       └── SKILL.md                          ← NEW (hlavní skill)
├── CLAUDE.md                                 ← MODIFY (reasoning_effort + skill reference)
├── commands/
│   └── iq.md                                 ← DELETE
├── scripts/
│   ├── effort-stats.js                       ← NEW (CLI agregace logu)
│   └── effort-stats.test.js                  ← NEW (node --test test)
└── logs/
    └── effort-decisions.jsonl                ← runtime (auto-created skillem; .gitignore)
```

**.gitignore update:** přidat `logs/effort-decisions.jsonl` (osobní telemetrie, ne do gitu).

---

## Task 1: Vytvořit skelet skillu token-aware (frontmatter + rubriky)

**Files:**
- Create: `C:\Users\levingerm\.claude\skills\token-aware\SKILL.md`

- [ ] **Step 1: Vytvořit složku skillu**

```bash
mkdir -p ~/.claude/skills/token-aware
```

- [ ] **Step 2: Zapsat SKILL.md s frontmatter + rubrikami + status řádkem + logging instrukcí**

Zapiš celý obsah souboru `~/.claude/skills/token-aware/SKILL.md`:

````markdown
---
name: token-aware
description: |
  Use BEFORE writing implementation plans, design specs, or starting non-trivial
  implementation work. Use BEFORE dispatching 2+ Agent tools to pick model strategy
  (haiku for mechanical lookups, sonnet for structured analysis, opus for decisions).
  Use whenever the user signals reasoning level changes or asks about agent strategy.

  Trigger phrases (CZ + EN):
  - effort DOWN: "sniž effort", "míň přemýšlej", "IQ dolů", "rychle", "pohoda mode",
    "nepřemýšlej tolik", "lehký režim", "lower effort", "less thinking", "faster",
    "easy mode", "speed mode"
  - effort UP: "zvedni effort", "přemýšlej víc", "IQ nahoru", "tohle je složitý",
    "více reasoning", "hluboce", "důkladně", "more thinking", "deep think",
    "raise IQ", "harder mode"
  - agent strategy: "zvaž agenty", "jaké agenty použiješ", "rozdělej to",
    "použij haiku", "levné agenty", "více agentů paralelně", "consider agents",
    "which agents", "use haiku", "cheap agents", "parallelize"
  - review / introspection: "co používáš", "jaký model", "ukaž rozhodnutí",
    "co's vybral", "what model", "show decision"

  Do NOT invoke for: greeting, single factual answer, syntax lookup, single-line
  edit, recall from memory, status / git questions, theme changes.
---

# token-aware

Adaptivní řízení reasoning effortu + výběr modelu pro subagenty. Šetří tokeny tím, že:

1. Defaultní reasoning floor je **75** (ne 99) — CLAUDE.md to forsí.
2. Tahle skill řekne kdy zvednout na **99** nebo snížit na **60**.
3. Mechanické úlohy delegujeme na **haiku** / **sonnet** subagenty (Agent tool má parametr `model`).

## Co dělat při invokaci

1. **Vyhodnoť rubriku effortu** (níže) → vyber 60 / 75 / 99.
2. **Vyhodnoť strategii agentů** (rubrika níže) → seznam plánovaných dispatches s modely.
3. **Vyrenderuj status řádek** jako první řádek odpovědi.
4. **Vlož `<reasoning_effort>X</reasoning_effort>`** tag hned pod status řádek.
5. **Appendni log** do `~/.claude/logs/effort-decisions.jsonl` jediným Bash voláním.

## Rubrika — effort

| IQ  | Kdy                                                | Příklady                                                                          |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| 60  | trivialita; odpověď z paměti / lookupu             | greeting, faktická Q, syntax lookup, formátování, 1-řádkový edit, "kde je X"      |
| 75  | default — rutinní implementace, známý kontext      | 2–3 souborová změna, jednoduchý refactor, doplnění featury, čtení diffu           |
| 99  | komplex — vyžaduje hloubku                         | architektura, multi-soubor refactor, debugging neznámého bugu, security audit, design s trade-offy, novostavba featury |

## Rubrika — agent model

| Model      | Pro co                                          | Příklady tasků                                                                 |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| **haiku**  | mechanické / lookup / aggregate                 | grep, file find, "kde je definované X", lint cleanup, hromadný rename          |
| **sonnet** | strukturovaná analýza / paralelní průzkum       | code review, doc summary, audit jedné domény, 2-3 paralelní explores se syntézou |
| **opus**   | rozhodování + integrace (hlavní turn)           | hlavní turn (vždy), planning, design, integrace výstupů, debugging multi-souborový |

## Status řádek (přesný formát)

Bez subagentů:

```
[ IQ:75 │ main:opus │ agenti: – ]
```

Se subagenty (po rozhodnutí, ne až po dispatch):

```
[ IQ:99 │ main:opus │ agenti: 2×haiku(explore), 1×sonnet(audit) ]
```

Status řádek jde **vždy na první řádek odpovědi**, hned za ním `<reasoning_effort>X</reasoning_effort>`, pak prázdný řádek, pak odpověď.

## Logging

Po každém rozhodnutí appendni jeden řádek JSONL do `~/.claude/logs/effort-decisions.jsonl`. Pokud složka `logs/` neexistuje, vytvoř ji.

Příklad Bash volání (jeden line, žádný node parsing):

```bash
mkdir -p ~/.claude/logs && printf '%s\n' '{"ts":"2026-05-13T15:30:00Z","trigger":"writing-plans","effort":99,"main":"opus","agents":[{"model":"haiku","role":"explore","count":2}],"user_intent":"naplánuj refactor X"}' >> ~/.claude/logs/effort-decisions.jsonl
```

Klíče (povinné): `ts`, `trigger`, `effort`, `main`, `agents` (array — může být prázdné), `user_intent` (max 80 znaků, sanitizováno — žádné nové řádky, žádné apostrofy které by rozbily shell).

Pokud appendnutí selže (disk full, perms), pokračuj bez něj — logování nesmí blokovat odpověď.

## Triggery podle situace

- **Explicitní fráze** (viz frontmatter description) → invokovat skill na začátku turnu.
- **User žádá plán / spec / design** → invokovat (effort obvykle 99).
- **User žádá netriviální implementaci** (více souborů, refactor, nová feature) → invokovat.
- **Chystáš 2+ Agent dispatch** → invokovat pro rozhodnutí modelů.
- **Trivialita** (greeting, single Q, lookup, jednořádkový edit) → **neinvokovat**, použít default 75 z CLAUDE.md, status řádek nerenderovat.

## Override pravidla

- User řekne "sniž effort" → další turn IQ:60 dokud se kontext nezmění (refactor request → znova vyhodnotit).
- User řekne "použij haiku všude" → další turn všechny agenty haiku, dokud se neukáže že kvalita nestačí.
- Skill se sám nezacyklí — pokud byl invokován v předchozím turnu a kontext se nemění, neinvokuj znova.
````

- [ ] **Step 3: Commit**

```bash
git -C ~/.claude add skills/token-aware/SKILL.md
git -C ~/.claude commit -m "feat(token-aware): skill pro adaptivní effort + agent routing"
```

---

## Task 2: Upravit CLAUDE.md — snížit reasoning floor + přidat status řádek instrukci

**Files:**
- Modify: `C:\Users\levingerm\.claude\CLAUDE.md:4` (reasoning_effort)
- Modify: `C:\Users\levingerm\.claude\CLAUDE.md:30-35` (přidat token-aware skill do seznamu)

- [ ] **Step 1: Změnit `<reasoning_effort>99</reasoning_effort>` na 75**

Edit řádku 4 v `~/.claude/CLAUDE.md`.

**Před:**
```
## Reasoning effort override
<reasoning_effort>99</reasoning_effort>
```

**Po:**
```
## Reasoning effort override
<reasoning_effort>75</reasoning_effort>

Toto je **floor** — výchozí úroveň. Skill `token-aware` ho může zvednout (99) nebo
snížit (60) podle úlohy. Na začátku každé netriviální odpovědi vyrenderuj status řádek
ve formátu `[ IQ:X │ main:opus │ agenti:… ]`. Před plánováním, psaním specs a
netriviální implementací invokuj skill `token-aware`.
```

- [ ] **Step 2: Přidat skill `token-aware` do seznamu tech-specific pravidel**

Edit konce souboru (seznam skills). Přidat řádek nad `Electron security`:

**Před:**
```
Tech-specific pravidla jsou v samostatných skills (progressive disclosure):
- **Electron security** (`contextIsolation`, CSP, IPC) → skill `electron-security`
```

**Po:**
```
Tech-specific pravidla jsou v samostatných skills (progressive disclosure):
- **Token-aware effort** (adaptivní reasoning + agent routing + status řádek) → skill `token-aware`
- **Electron security** (`contextIsolation`, CSP, IPC) → skill `electron-security`
```

- [ ] **Step 3: Verify**

```bash
grep -n "reasoning_effort" ~/.claude/CLAUDE.md
grep -n "token-aware" ~/.claude/CLAUDE.md
```

Expected:
- Řádek se `<reasoning_effort>75</reasoning_effort>`
- Řádek se `token-aware` v seznamu skills

- [ ] **Step 4: Commit**

```bash
git -C ~/.claude add CLAUDE.md
git -C ~/.claude commit -m "feat(CLAUDE.md): floor reasoning 75 + instrukce status řádku + token-aware reference"
```

---

## Task 3: Smazat `/iq` command (nahrazen přirozeným jazykem)

**Files:**
- Delete: `C:\Users\levingerm\.claude\commands\iq.md`

- [ ] **Step 1: Smazat soubor**

```bash
rm ~/.claude/commands/iq.md
```

- [ ] **Step 2: Verify**

```bash
test -f ~/.claude/commands/iq.md && echo "STILL EXISTS" || echo "DELETED OK"
```

Expected: `DELETED OK`

- [ ] **Step 3: Commit**

```bash
git -C ~/.claude add -A commands/iq.md
git -C ~/.claude commit -m "chore(commands): smazat /iq, nahrazeno přirozeným jazykem skillu token-aware"
```

---

## Task 4: Test pro effort-stats.js (TDD — failing test first)

**Files:**
- Create: `C:\Users\levingerm\.claude\scripts\effort-stats.test.js`

- [ ] **Step 1: Vytvořit složku scripts (pokud chybí) a napsat failing test**

```bash
mkdir -p ~/.claude/scripts
```

Zapiš `~/.claude/scripts/effort-stats.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { aggregate } = require('./effort-stats.js');

test('aggregate vrátí počty effortu', () => {
  const lines = [
    { ts: '2026-05-13T10:00:00Z', trigger: 'writing-plans', effort: 99, main: 'opus', agents: [] },
    { ts: '2026-05-13T10:05:00Z', trigger: 'explicit', effort: 75, main: 'opus', agents: [] },
    { ts: '2026-05-13T10:10:00Z', trigger: 'explicit', effort: 75, main: 'opus', agents: [] },
    { ts: '2026-05-13T10:15:00Z', trigger: 'auto', effort: 60, main: 'opus', agents: [] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.effortCounts[60], 1);
  assert.strictEqual(result.effortCounts[75], 2);
  assert.strictEqual(result.effortCounts[99], 1);
  assert.strictEqual(result.totalTurns, 4);
});

test('aggregate sečte modely subagentů', () => {
  const lines = [
    { ts: 't1', trigger: 'x', effort: 75, main: 'opus', agents: [{ model: 'haiku', role: 'grep', count: 2 }] },
    { ts: 't2', trigger: 'x', effort: 75, main: 'opus', agents: [{ model: 'haiku', role: 'find', count: 1 }, { model: 'sonnet', role: 'review', count: 1 }] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.agentCounts.haiku, 3);
  assert.strictEqual(result.agentCounts.sonnet, 1);
  assert.strictEqual(result.agentCounts.opus || 0, 0);
});

test('aggregate top triggery', () => {
  const lines = [
    { ts: 't', trigger: 'writing-plans', effort: 99, main: 'opus', agents: [] },
    { ts: 't', trigger: 'writing-plans', effort: 99, main: 'opus', agents: [] },
    { ts: 't', trigger: 'explicit-down', effort: 60, main: 'opus', agents: [] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.triggerCounts['writing-plans'], 2);
  assert.strictEqual(result.triggerCounts['explicit-down'], 1);
});
```

- [ ] **Step 2: Spustit test — musí selhat (effort-stats.js zatím neexistuje)**

```bash
node --test ~/.claude/scripts/effort-stats.test.js
```

Expected: FAIL — `Cannot find module './effort-stats.js'`

---

## Task 5: Implementovat effort-stats.js (make tests pass)

**Files:**
- Create: `C:\Users\levingerm\.claude\scripts\effort-stats.js`

- [ ] **Step 1: Zapsat effort-stats.js s `aggregate()` + CLI wrapper**

Zapiš `~/.claude/scripts/effort-stats.js`:

```javascript
#!/usr/bin/env node
// Agreguje ~/.claude/logs/effort-decisions.jsonl — vypíše distribuci effortu,
// počty agentních dispatchů per model, a top triggery. Slouží k vytříbení
// rubriky skillu token-aware.

const fs = require('fs');
const path = require('path');
const os = require('os');

function aggregate(lines) {
  const effortCounts = { 60: 0, 75: 0, 99: 0 };
  const agentCounts = {};
  const triggerCounts = {};
  let totalTurns = 0;

  for (const entry of lines) {
    if (!entry || typeof entry !== 'object') continue;
    totalTurns++;
    if (entry.effort != null && effortCounts[entry.effort] !== undefined) {
      effortCounts[entry.effort]++;
    }
    if (Array.isArray(entry.agents)) {
      for (const a of entry.agents) {
        if (!a || !a.model) continue;
        agentCounts[a.model] = (agentCounts[a.model] || 0) + (a.count || 1);
      }
    }
    if (entry.trigger) {
      triggerCounts[entry.trigger] = (triggerCounts[entry.trigger] || 0) + 1;
    }
  }

  return { effortCounts, agentCounts, triggerCounts, totalTurns };
}

function bar(n, max, width = 24) {
  if (max === 0) return '';
  const filled = Math.round((n / max) * width);
  return '█'.repeat(filled) + '·'.repeat(width - filled);
}

function readLog(logPath) {
  if (!fs.existsSync(logPath)) return [];
  const raw = fs.readFileSync(logPath, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return out;
}

function report(agg) {
  const lines = [];
  lines.push(`Token-aware decisions: ${agg.totalTurns} turnů celkem`);
  lines.push('');
  lines.push('Effort distribuce:');
  const maxE = Math.max(...Object.values(agg.effortCounts), 1);
  for (const level of [60, 75, 99]) {
    const c = agg.effortCounts[level];
    const pct = agg.totalTurns ? Math.round((c / agg.totalTurns) * 100) : 0;
    lines.push(`  IQ:${level}  ${bar(c, maxE)} ${c} (${pct}%)`);
  }
  lines.push('');
  lines.push('Subagent dispatches per model:');
  const agentEntries = Object.entries(agg.agentCounts).sort((a, b) => b[1] - a[1]);
  if (agentEntries.length === 0) lines.push('  (žádné)');
  else for (const [model, n] of agentEntries) lines.push(`  ${model.padEnd(8)} ${n}×`);
  lines.push('');
  lines.push('Top triggery:');
  const trigEntries = Object.entries(agg.triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (trigEntries.length === 0) lines.push('  (žádné)');
  else for (const [t, n] of trigEntries) lines.push(`  ${t.padEnd(24)} ${n}`);
  return lines.join('\n');
}

if (require.main === module) {
  const logPath = path.join(os.homedir(), '.claude', 'logs', 'effort-decisions.jsonl');
  const lines = readLog(logPath);
  console.log(report(aggregate(lines)));
}

module.exports = { aggregate, report, readLog };
```

- [ ] **Step 2: Spustit testy — musí projít**

```bash
node --test ~/.claude/scripts/effort-stats.test.js
```

Expected: PASS (3 testy)

- [ ] **Step 3: Spustit script proti reálnému (zatím prázdnému / neexistujícímu) logu**

```bash
node ~/.claude/scripts/effort-stats.js
```

Expected: výpis se 0 turny, `(žádné)` u agentů a triggerů — žádná chyba.

- [ ] **Step 4: Commit**

```bash
git -C ~/.claude add scripts/effort-stats.js scripts/effort-stats.test.js
git -C ~/.claude commit -m "feat(scripts): effort-stats.js — agregace token-aware decisions logu"
```

---

## Task 6: .gitignore — runtime log nepatří do gitu

**Files:**
- Modify: `C:\Users\levingerm\.claude\.gitignore`

- [ ] **Step 1: Mrknout co je v .gitignore aktuálně**

```bash
cat ~/.claude/.gitignore
```

- [ ] **Step 2: Přidat řádek pro logs/effort-decisions.jsonl (pokud tam ještě není)**

Edit `~/.claude/.gitignore` — přidat na konec (pokud `logs/` nebo konkrétní soubor ještě nejsou pokryté):

```
# token-aware runtime telemetrie
logs/effort-decisions.jsonl
```

- [ ] **Step 3: Verify**

```bash
grep -E "logs/|effort-decisions" ~/.claude/.gitignore
```

Expected: match na nově přidané řádky.

- [ ] **Step 4: Commit**

```bash
git -C ~/.claude add .gitignore
git -C ~/.claude commit -m "chore(gitignore): ignorovat logs/effort-decisions.jsonl"
```

---

## Task 7: Smoke test (manuální acceptance)

**Files:** žádné — interaktivní test v živé Claude Code session.

- [ ] **Step 1: Restart Claude Code session, aby se nový skill načetl**

V terminálu: ukončit aktuální `claude` session, spustit novou v `~/.claude/`.

- [ ] **Step 2: Trivialita — status řádek nemá být**

Napiš: `co je dneska za den?`

Expected: krátká odpověď bez status řádku, bez `<reasoning_effort>` tagu (skill se neinvokuje).

- [ ] **Step 3: Default work — status řádek IQ:75**

Napiš: `přidej do README odstavec o licenci`

Expected: odpověď začíná `[ IQ:75 │ main:opus │ agenti: – ]` + `<reasoning_effort>75</reasoning_effort>`.

- [ ] **Step 4: Komplex — status řádek IQ:99**

Napiš: `naplánuj refactor autentizace v projektu X`

Expected: status řádek `[ IQ:99 │ main:opus │ agenti: … ]` (může obsahovat haiku/sonnet plán).

- [ ] **Step 5: Explicit down**

Napiš: `sniž effort`

Expected: další turn `[ IQ:60 │ main:opus │ agenti: – ]`.

- [ ] **Step 6: Explicit up**

Napiš: `přemýšlej víc, je to složitý`

Expected: další turn `[ IQ:99 │ main:opus │ agenti: – ]`.

- [ ] **Step 7: Agent dispatch — haiku v praxi**

Napiš: `najdi mi všechny TODO komentáře v ~/.claude/skills/`

Expected: status řádek ukazuje aspoň `1×haiku(grep)` nebo podobně; reálný Agent call s `model: "haiku"`.

- [ ] **Step 8: Logging funguje**

```bash
cat ~/.claude/logs/effort-decisions.jsonl
```

Expected: minimálně 4 JSONL řádky (steps 3, 4, 5, 6).

- [ ] **Step 9: Stats script**

```bash
node ~/.claude/scripts/effort-stats.js
```

Expected: tabulka s distribucí effortu napříč zachycenými turny.

- [ ] **Step 10: Pokud něco neklape — iterace na SKILL.md description**

Pokud Claude skill neinvokoval kdy měl, uprav `description` v `~/.claude/skills/token-aware/SKILL.md` — přidej víc trigger frází nebo zostři "Use BEFORE" pravidla. Pak commit + retest.

---

## Self-review checklist (po dokončení všech tasků)

- [ ] Spec coverage: každá komponenta ze specu má task (skill, CLAUDE.md, /iq smazání, effort-stats.js, gitignore, smoke test) ✓
- [ ] Placeholder scan: žádné TBD / TODO / "implement later" v plánu ✓
- [ ] Type consistency: `aggregate()` má stejnou signaturu v testech i implementaci ✓
- [ ] Status řádek formát konzistentní napříč SKILL.md, CLAUDE.md, smoke testem ✓
