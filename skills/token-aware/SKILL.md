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
5. **Zapiš IQ snapshot** do `~/.claude/cache/iq-state.json` (čte statusLine pro spodní panel).
6. **Appendni log** do `~/.claude/logs/effort-decisions.jsonl` jediným Bash voláním.

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

## IQ snapshot pro statusLine

Status line panel (spodní řádek) má segment `iq` který čte `~/.claude/cache/iq-state.json`. Po každém rozhodnutí zapiš (overwrite) aktuální stav. Bez tohoto kroku zůstane v panelu starý/default `IQ:75 main:opus`.

Formát souboru — mapa per sessionId + `_latest` fallback:

```json
{
  "_latest": { "ts": 1715683200000, "iq": 99, "main": "opus", "plannedAgents": [{"model":"sonnet","role":"audit","count":1}] },
  "<sessionId>": { "ts": 1715683200000, "iq": 99, "main": "opus", "plannedAgents": [] }
}
```

Doporučený zápis (jeden Bash call, node inline — atomic merge):

```bash
mkdir -p ~/.claude/cache && node -e "const fs=require('fs'),p=require('os').homedir()+'/.claude/cache/iq-state.json';let a={};try{a=JSON.parse(fs.readFileSync(p,'utf8'))}catch{};const s={ts:Date.now(),iq:99,main:'opus',plannedAgents:[{model:'sonnet',role:'audit',count:1}]};a._latest=s;a['<sessionId>']=s;fs.writeFileSync(p,JSON.stringify(a));"
```

Pole `plannedAgents` může být prázdné. Pokud sessionId neznáš (rare), zapiš jen do `_latest`.

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
