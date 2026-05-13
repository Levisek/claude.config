# token-aware skill — design

**Date:** 2026-05-13
**Owner:** Martin Levinger
**Status:** Proposed
**Repo:** `~/.claude/`

## Cíl

Snížit spotřebu tokenů (zejména reasoning) přes:

1. nižší **floor** reasoning effortu (75 místo 99),
2. **adaptivní** zvedání/snižování per turn,
3. **vědomé delegování** mechanických úloh na levnější modely (`haiku`, `sonnet`) přes Agent tool,
4. **vizuální indikaci** každého rozhodnutí (status řádek),
5. **přirozený jazyk** místo `/iq` commandu,
6. **logování** rozhodnutí pro pozdější vytříbení rubriky.

## Komponenty

### 1. `~/.claude/skills/token-aware/SKILL.md` (nový)

Hlavní skill. Skill-level rozhodovací logika.

**Frontmatter description (rozšířená, kompletní triggery):**

```yaml
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
```

**Tělo skillu obsahuje:**

- Rubriku effort 60 / 75 / 99 (viz níže).
- Rubriku model: haiku / sonnet / opus + příklady tasků.
- Přesný formát status řádku.
- Instrukci pro logging do `~/.claude/logs/effort-decisions.jsonl`.
- Pravidlo: vždy začni odpověď status řádkem + `<reasoning_effort>X</reasoning_effort>` tagem.

### 2. `~/.claude/CLAUDE.md` (úprava)

**Před:**
```
<reasoning_effort>99</reasoning_effort>
```

**Po:**
```
<reasoning_effort>75</reasoning_effort>

Na začátku každé netriviální odpovědi vyrenderuj status řádek
`[ IQ:X │ main:model │ agenti:… ]`. Před plánováním, psaním specs
a netriviální implementací invokuj skill `token-aware` pro
rozhodnutí o effortu a strategii agentů.
```

Plus aktualizace seznamu skills v sekci "Tech-specific pravidla":
přidat řádek `- **Token-aware effort** (adaptivní reasoning + agent routing) → skill token-aware`.

### 3. `~/.claude/commands/iq.md` → **smazat**

Funkci převezme přirozený jazyk přes triggery skillu.

### 4. `~/.claude/logs/effort-decisions.jsonl` (nový, auto-creates)

Append-only JSONL. Skill po každém rozhodnutí appendne řádek:

```json
{"ts":"2026-05-13T14:23:11.000Z","trigger":"writing-plans","effort":75,"main":"opus","agents":[{"model":"haiku","role":"explore","count":2}],"user_intent_snippet":"udělej mi roadmapu na X"}
```

Skill **nevolá node skript** — append řeší Claude přes Bash `>>` nebo Write append (one-shot). Žádné nové dependency.

### 5. `~/.claude/scripts/effort-stats.js` (nový)

CLI utilita pro agregaci logu. Spouští se ručně, ne ze skillu.

```bash
node ~/.claude/scripts/effort-stats.js
# výstup:
#   posledních 30 dní:
#   IQ:60 ████████ 23 turnů (18%)
#   IQ:75 ████████████████████████ 78 turnů (62%)
#   IQ:99 █████████ 25 turnů (20%)
#   agents: haiku 31×, sonnet 14×, opus 4× (subagent dispatches)
#   top triggers: writing-plans (18), explicit "sniž" (12), explicit "zvedni" (9)
```

## Rubrika — effort

| IQ  | Kdy                                                          | Příklady                                                       |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 60  | trivialita; odpověď je z paměti / lookupu                    | greeting, faktická Q, syntax lookup, formátování, 1-řádkový edit, "kde je X" |
| 75  | default — rutinní implementace, známý kontext                | 2–3 souborová změna, jednoduchý refactor, doplnění featury, čtení diffu |
| 99  | komplex — vyžaduje hloubku                                   | architektura, multi-soubor refactor, debugging neznámého bugu, security audit, design s trade-offy, novostavba featury |

## Rubrika — agent model

| Model    | Pro co                                                       | Příklady tasků                                                 |
| -------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| **haiku**  | mechanické / lookup / aggregate                              | grep, file find, "kde je definované X", lint cleanup, hromadný rename, file lookup přes Explore agent |
| **sonnet** | strukturovaná analýza / paralelní průzkum / review           | code review, doc summary, audit jedné domény, 2-3 paralelní explores se syntézou |
| **opus**   | rozhodování + integrace                                      | hlavní turn (vždy), planning, design, integrace výstupů více subagentů, debugging multi-souborový |

## Status řádek (přesný formát)

Bez agentů:
```
[ IQ:75 │ main:opus │ agenti: – ]
```

S dispatchovanými agenty (po dispatchnutí, ne před):
```
[ IQ:75 │ main:opus │ agenti: 2×haiku(explore), 1×sonnet(audit) ]
```

Po změně effortu uprostřed konverzace:
```
[ IQ:60 │ main:opus │ agenti: – ]
```

Status řádek jde **vždy na první řádek odpovědi** (před `<reasoning_effort>` tagem). Cena: ~20 output tokenů per turn. Akceptovaný trade-off za viditelnost.

## Data flow

```
User píše zprávu
   ↓
Claude detekuje turn
   ↓
Match trigger?
   ├─ explicit phrase ("sniž effort", "zvaž agenty", …)
   ├─ chystá writing-plans / executing-plans / spec
   ├─ chystá netriviální implementaci
   └─ chystá 2+ Agent dispatch
   ↓
ANY trigger? → invoke `token-aware` skill
   ↓
Skill vrátí: effort + main model + agent strategy + status řádek
   ↓
Claude appendne log do effort-decisions.jsonl
   ↓
Renderuje:
   [ status řádek ]
   <reasoning_effort>X</reasoning_effort>
   ... vlastní odpověď ...
   ↓
Pokud dispatchne Agent → použije strategy.model
```

## Error handling

- **Skill se neaktivuje** (description nesedla) → fallback: CLAUDE.md říká `<reasoning_effort>75</reasoning_effort>`, status řádek se nerenderuje. Žádná regrese vůči současnému stavu.
- **Logování selže** (disk full, perms) → tichý fallback, neblokovat odpověď.
- **Špatný odhad effortu** → uživatel řekne "sniž / zvedni", trigger znova invokuje skill.

## Testing

Manuální acceptance scénáře (po implementaci):

1. **Trivialita** — *"jaký dneska den?"* → status řádek `[ IQ:60 │ main:opus │ agenti: – ]`, krátká odpověď bez thinking spam.
2. **Default** — *"přidej do `foo.ts` parametr `bar`"* → `[ IQ:75 │ main:opus │ agenti: – ]`.
3. **Komplex** — *"naplánuj mi refactor autentizace"* → invokuje token-aware → status `[ IQ:99 │ main:opus │ agenti: – ]` + plán delegace (např. 2×haiku grep).
4. **Explicit down** — *"sniž effort"* → další odpověď `IQ:60`.
5. **Explicit up** — *"přemýšlej víc"* → další odpověď `IQ:99`.
6. **Agent dispatch** — *"udělej audit security v `src/`"* → skill rozhodne 2×sonnet agentů s paralelním Agent voláním, status řádek to zreflektuje.
7. **Logging** — po 5 turnech: `cat ~/.claude/logs/effort-decisions.jsonl` ukáže 5 řádků.
8. **Stats** — `node ~/.claude/scripts/effort-stats.js` vypíše agregaci.

## Co je out-of-scope

- Změna `effortLevel` v `settings.json` (zůstává `xhigh` jako ceiling).
- Automatický cron pro statistics report.
- UI dashboard / web view logu.
- Statusline (terminálová) změna — řeší se výhradně v odpovědi Claudea.

## Implementační kroky (hrubé pořadí)

1. Vytvořit `~/.claude/skills/token-aware/SKILL.md`.
2. Upravit `~/.claude/CLAUDE.md` — snížit reasoning_effort, přidat instrukci o status řádku + skill reference.
3. Smazat `~/.claude/commands/iq.md`.
4. Vytvořit `~/.claude/scripts/effort-stats.js` (jednoduchý JSONL parser → konzolový report).
5. Commit (samostatný; popis: "feat(token-aware): adaptivní effort + agent routing skill").
6. Manuální smoke test scénářů 1–8 výše.
