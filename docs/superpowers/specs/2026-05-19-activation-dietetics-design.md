# Activation & Dietetics — Design Spec

**Date:** 2026-05-19
**Status:** Draft → user review pending
**Sub-projekt:** B z trojice {A: Subagent fleet ✅ shipped, B: Activation & dietetics, C: Memory lifecycle}
**Cíl:** Snížit per-session token overhead přes 3 přímá opatření: exclude stale CLAUDE.md soubory, slim SessionStart banner pro non-startup sources, scaffoldnout skill hints v UserPromptSubmit hooku.

---

## 1. Motivace a analýza

PDF *Claude Code Native Orchestration & Automation* dokumentuje tři vektory:
- `claudeMdExcludes` v `settings.json` skipne vendored / orphan CLAUDE.md soubory při walku
- SessionStart hook stdout se injektuje jako `additionalContext` — což je per-session náklad
- UserPromptSubmit hook může injektovat hinty pro skill activation

Aktuální stav projektu (verified při exploration):

- `~/.claude/CLAUDE.md` má 101 řádků (pod 200 doporučených)
- 14 CLAUDE.md souborů existuje napříč filesystemem; klíčové vendored: `skills/trailofbits/CLAUDE.md` (223 řádků contributing guide), `plugins/cache/.../superpowers/5.0.7/CLAUDE.md` + `5.1.0/CLAUDE.md` (PR rules pro upstream maintainery, irelevantní pro user sessions)
- `session-context.js` už podmiňuje figlet banner na `source === 'startup'` — to je dobrá báze, ale ostatní elementy (git panel, sparkline, welcome tip) jsou bez podmínky
- `detect-triggers.js` má 2 trigger groups (token-aware + time-aware) — žádné skill hinty

**Nepostradí "smart skill activation hook" v plné PDF Pattern C podobě** (full SKILL.md content injection per keyword) protože:
- Skill descriptions už jsou v system reminderu (lazy-loaded při invocation)
- Pre-injecting plný content přes hook by tokeny ZVÝŠILo
- Skills se aktivují přes Anthropic resolver z descriptions, ne přes naše hooky

Sub-projekt B se proto soustředí na **měřitelné per-session úspory**, ne na nepřímé hint-injection.

## 2. Scope (in / out)

**In scope:**

- Win 1: `claudeMdExcludes` field v `~/.claude/settings.json` (3 glob patterns)
- Win 2: Source-aware větvení v `~/.claude/hooks/session-context.js` (startup vs resume vs clear vs compact)
- Win 3: Konzervativní skill hints v `~/.claude/hooks/detect-triggers.js` (3 task-phrase skupiny, 3 řádky hint output)

**Out of scope (jiné sub-projekty nebo cleanup mimo):**

- CLAUDE.md trim ze 101 řádků (user odmítl pro Win 4 — risk regrese po nedávných změnách)
- Smazat orphan `~/.claude-config/CLAUDE.md` a `~/FPLPro/CLAUDE.md` (cleanup task pro user manuálně, ne přes excludes)
- PreCompact + SessionEnd lifecycle (Sub-projekt C)
- Full SKILL.md content injection via hook (rozhodnuto že má diminishing returns)

## 3. Architektura

```
~/.claude/settings.json                    ← Win 1 (přidat 1 pole "claudeMdExcludes")
~/.claude/hooks/session-context.js         ← Win 2 (úprava existující logiky podle source)
~/.claude/hooks/detect-triggers.js         ← Win 3 (přidat skillHints array + match větev)

Nové testy:
~/.claude/hooks/session-context.test.js    ← NEW
~/.claude/hooks/detect-triggers.test.js    ← EXISTS (rozšířit o 3 cases pro skill hints)
```

Žádný nový hook event ani settings flag — všechny změny v existujících souborech.

## 4. Win 1 — claudeMdExcludes

### 4.1 Změna v `settings.json`

Přidat do root objektu, vedle `permissions`/`hooks`/`statusLine`:

```json
"claudeMdExcludes": [
  "**/node_modules/**/CLAUDE.md",
  "**/.claude/plugins/cache/**/CLAUDE.md",
  "**/.claude/skills/trailofbits/CLAUDE.md"
]
```

### 4.2 Per-pattern zdůvodnění

| Pattern | Důvod | Verified count |
|---|---|---|
| `**/node_modules/**/CLAUDE.md` | Preventivní — kdyby npm balík nesl CLAUDE.md (vzácné, ale 0 cost) | 0 aktuálně, future-proof |
| `**/.claude/plugins/cache/**/CLAUDE.md` | Superpowers contributor guides (PR rules pro upstream), irelevantní pro user sessions | 2 (5.0.7, 5.1.0) |
| `**/.claude/skills/trailofbits/CLAUDE.md` | 223-řádkový contributing guide pro trailofbits sub-skill, loaduje se jen při walku do té podsložky | 1 |

### 4.3 Záměrně NEvylučováno

- `~/.claude-config/CLAUDE.md` (35 řádků, obsahuje deprecated `<reasoning_effort>` tag) — to je orphan a doporučuju ho ručně smazat. `claudeMdExcludes` není správný nástroj na orphans, ten zaslouží `rm`.
- `~/FPLPro/CLAUDE.md` a `~/Můj disk/FPLPro/CLAUDE.md` — loadují se jen pokud Claude session běží v té cestě (`cwd` v té podsložce). Pro projekty na `/c/dev/FPLPro/` se neuplatňují.

### 4.4 Token impact

Odhadovaně **400-800 tokenů/session** ušetřeno když Claude prochází vyloučené subtrees (např. během exploration superpowers plugin skills, nebo při šahání do trailofbits). Konzervativní odhad — měřit lze porovnáním předtím/potom.

## 5. Win 2 — Source-aware SessionStart diet

### 5.1 Aktuální chování

`session-context.js` čte `data.source` ale používá ho jen pro 1 podmínku (figlet banner jen na `startup`). Ostatní elementy (git panel, sparkline 3 commits, dirty count, welcome tip) se renderují vždy.

### 5.2 Cílový state — tabulka chování per source

| source | Figlet banner | Git branch+upstream | Sparkline + top 3 commits | Dirty count | Welcome tip |
|---|---|---|---|---|---|
| `startup` (default) | ✅ (jako teď) | ✅ | ✅ | ✅ | ✅ |
| `resume` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `clear` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `compact` | ❌ | ✅ | ✅ | ✅ | ❌ |

**Klíčové rozdíly:**
- `resume`/`clear`: skip banner + skip sparkline (Claude rebuilduje context, nepotřebuje branding ani historii commitů — užitečné jen na startup)
- `compact`: skip banner + tip ale KEEP sparkline (Claude lost working memory, sparkline pomáhá zorientovat se v nedávné aktivitě)
- Welcome tip pouze na `startup` — ostatní sources znamenají, že user už ví co dělá

### 5.3 Implementační skicování

V `session-context.js`, místo aktuálního:

```javascript
const shouldBanner = config.banner.showFiglet
    && source === 'startup'
    && (git.inRepo || proj.hasPackageJson);
```

Rozšířit na:

```javascript
const shouldBanner = config.banner.showFiglet
    && source === 'startup'
    && (git.inRepo || proj.hasPackageJson);

const shouldSparkline = source === 'startup' || source === 'compact';
const shouldTip = source === 'startup' && config.banner.showWelcomeTip;
```

A v render bloku použít `shouldSparkline`/`shouldTip` místo přímých `config.banner.showWelcomeTip` referencí.

### 5.4 Token impact

`resume`/`clear` ušetří ~300-500 tokenů per session (skip ~10 řádků banner + ~6 řádků sparkline+commits).
`compact` ušetří ~150 tokenů (skip banner + tip).
Compounded: typický uživatel má více `resume` než `startup` sessions → měřitelné úspory.

## 6. Win 3 — Skill hints v detect-triggers

### 6.1 Doplněk, ne replacement

Hook ZACHOVÁ existující token-aware + time-aware logiku. Přidá NOVOU sekci skillHints která emituje jednořádkové hinty pro 3 task-phrase skupiny.

### 6.2 Trigger groups

```javascript
const skillHints = [
  {
    name: 'tsc-verification',
    keywords: ['tsc check', 'kompiluje', 'npx tsc', 'spusť tsc', 'tsc --noemit'],
    hint: '[Hint] Skill `tsc-verification` may apply for this task.',
  },
  {
    name: 'security-audit',
    keywords: ['zkontroluj bezpečnost', 'bezpečnostní audit', 'audit kódu', 'najdi zranitelnosti', 'security audit', 'security review'],
    hint: '[Hint] Skill `security-audit` may apply for this task.',
  },
  {
    name: 'visual-audit',
    keywords: ['vizuální audit', 'visual audit', 'wcag', 'ui audit', 'projdi ui', 'kontrast audit'],
    hint: '[Hint] Skill `visual-audit` may apply for this task.',
  },
];
```

**Záměrně multi-word phrasing** (ne jen `tsc`, ne jen `audit`). Single-word triggery by způsobily false positives (např. "audit" jako generic slovo, "kontrast" v kontextu textur).

### 6.3 Match logika

Hook po existujícím tokenMatch/timeMatch bloku přidá:

```javascript
const matchedSkills = skillHints
  .filter(s => s.keywords.some(kw => prompt.includes(kw)))
  .map(s => s.hint);

if (matchedSkills.length > 0) {
  sections.push(matchedSkills.join('\n'));
}
```

### 6.4 Token impact

~30-80 tokenů per matched hint (jen pokud match). Není to hlavní win — scaffold pro budoucí expanzi, pomoc pod-triggered skillům.

## 7. Verifikace

### 7.1 Existence + syntax

```bash
node -e "JSON.parse(require('fs').readFileSync('/c/Users/admin/.claude/settings.json'))"
# Expected: parse OK, no output
```

### 7.2 SessionStart source-aware test

Nový soubor `~/.claude/hooks/session-context.test.js`:

- Spustí session-context.js s 4 různými JSON inputy (source startup/resume/clear/compact)
- Pro každý ověří přítomnost/absenci klíčových elementů v output (`additionalContext` field):
  - `startup`: contains "tip:" a contains "posledních" (sparkline)
  - `resume`: NOT contains "tip:" a NOT contains "posledních"
  - `clear`: NOT contains "tip:" a NOT contains "posledních"
  - `compact`: NOT contains "tip:" ale contains "posledních"
- Vrátí PASS/FAIL podle všech 4 cases

### 7.3 detect-triggers skill hints test

Rozšířit existující `~/.claude/hooks/detect-triggers.test.js` (z Sub-projektu A) o 3 cases:

- Prompt `"spusť tsc check na projektu"` → output contains `tsc-verification`
- Prompt `"udělej bezpečnostní audit"` → output contains `security-audit`
- Prompt `"chci visual audit s wcag"` → output contains `visual-audit`

A 1 negativní case: prompt `"hello world"` → output neobsahuje žádný z těch tří skill names.

### 7.4 Regression check

```bash
node ~/.claude/scripts/agent-stats.test.js      # exit 0
node ~/.claude/scripts/validate-agents.test.js   # exit 0
node ~/.claude/hooks/detect-triggers.test.js     # exit 0 (rozšířený)
node ~/.claude/hooks/session-context.test.js     # exit 0 (nový)
```

### 7.5 Manuální smoke test

```bash
echo '{"source":"resume","cwd":"/c/Users/admin/.claude"}' | node ~/.claude/hooks/session-context.js
echo '{"source":"startup","cwd":"/c/Users/admin/.claude"}' | node ~/.claude/hooks/session-context.js
```

Porovnat délku `additionalContext` mezi nimi — `resume` musí být kratší.

## 8. Rollback

Vše additive:

- Win 1: `git revert` na settings.json commit (1 pole zmizí)
- Win 2: `git revert` na session-context.js commit (vrátí původní logiku)
- Win 3: `git revert` na detect-triggers.js commit (skillHints array zmizí)
- Testy: `rm hooks/session-context.test.js`, případně undo expansion v detect-triggers.test.js

Žádný persistent state, migrace ani závislosti.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `claudeMdExcludes` glob syntax neuznáván Anthropic enginem v aktuální verzi | Před implementací cross-check že PDF citace odpovídá realitě (verify v `code.claude.com/docs/en/settings`). Pokud field nepodporován, padáme zpět na deleting orphan files. |
| Source-aware větve rozbijí existující `--source=startup` flow | Test §7.2 pokrývá všechny 4 sources. Default (`startup`) zachovává aktuální chování byte-by-byte. |
| Skill hints false-positive při generickém slovu (např. "audit kódu" matchuje i sentence o non-security audit) | Multi-word phrasing snižuje false-positive na minimum. Negativní test §7.3. Hinty jsou nelimitující — jen návrh, Claude neslepě nespustí skill. |
| Test `compact` source je obtížně reprodukovatelný (real session compaction není trivially trigger) | Hook test simuluje pouhým JSON inputem s `source: "compact"`. Není to integration test ale unit hook test. |
| Plugin cache se přepíše s novou verzí superpowers, vznikne nová cesta `plugins/cache/.../5.2.0/CLAUDE.md` | Glob pattern `**/.claude/plugins/cache/**/CLAUDE.md` pokryje i nové cesty. Future-proof. |

## 10. Success kritéria

- ✅ Všechny 3 wins shipped (Win 1+2+3 committed)
- ✅ Žádná regrese v existujících testech (agent-stats, validate-agents, detect-triggers token-aware)
- ✅ Nový session-context.test.js zelený na všech 4 source cases
- ✅ Rozšířený detect-triggers.test.js zelený na 3 nové + 1 negativní case
- ✅ Manuální smoke ukáže že `resume` output je kratší než `startup`
- Měření (delayed, 2 týdny): porovnání `cache/cost-cache.json` agregace mezi pre- a post-implementací — ideálně 5-10% pokles average per-session start cost

---

## Implementation plan

Bude vytvořen samostatně skillem `writing-plans` po schválení tohoto specu.
