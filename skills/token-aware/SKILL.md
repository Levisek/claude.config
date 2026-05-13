---
name: token-aware
description: |
  Use BEFORE dispatching 2+ Agent tools, BEFORE writing implementation plans or
  design specs that will trigger subagents, or whenever the user asks about
  agent strategy / model choice. Picks haiku for mechanical lookups, sonnet for
  structured analysis, opus for decisions.

  Trigger phrases (CZ + EN):
  - agent strategy: "zvaž agenty", "jaké agenty použiješ", "rozdělej to",
    "použij haiku", "levné agenty", "více agentů paralelně", "consider agents",
    "which agents", "use haiku", "cheap agents", "parallelize"
  - review / introspection: "co používáš", "jaký model", "ukaž rozhodnutí",
    "co's vybral", "what model", "show decision"

  Do NOT invoke for: greeting, single factual answer, syntax lookup, single-line
  edit, recall from memory, status / git questions, theme changes, plain
  implementation without subagents.
---

# token-aware

**Pouze routing modelů pro subagenty + viditelnost v panelu + logging.**

Effort se reguluje **implicitně přes model a komplexitu promptu**, ne přes
explicitní tag. Tahle skill **už nepíše** `IQ:X` ani `<reasoning_effort>` —
proč viz CLAUDE.md *Memory* (effort tag byl pseudo-knob, model si beztak
budget rozdělí sám).

## Co dělat při invokaci

1. **Vyhodnoť strategii agentů** (rubrika níže) → seznam plánovaných dispatches
   s konkrétními modely.
2. **Zapiš agent snapshot** do `~/.claude/cache/iq-state.json` — statusLine z
   toho vyrendruje `[ main:opus 4.7 │ plán: 2×haiku, 1×sonnet ]` (zobrazí se
   jen pokud je co ukázat).
3. **Appendni log** do `~/.claude/logs/agent-decisions.jsonl` jediným Bash
   voláním — pro pozdější retrospektivu kolik šetříme.

**Nepíšeš** v textu odpovědi žádný `[ IQ:X │ … ]` ani `<reasoning_effort>` tag.

## Rubrika — agent model

| Model      | Pro co                                          | Příklady tasků                                                                 |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| **haiku**  | mechanické / lookup / aggregate                 | grep, file find, "kde je definované X", lint cleanup, hromadný rename, SDD implementer (mechanic) |
| **sonnet** | strukturovaná analýza / paralelní průzkum       | code review, doc summary, audit jedné domény, 2-3 paralelní explores se syntézou, SDD code quality reviewer |
| **opus**   | rozhodování + integrace (hlavní turn)           | hlavní turn (vždy = já), planning, design, integrace výstupů, debugging multi-souborový |

Detail per-role pro SDD viz CLAUDE.md *Subagent budget*.

## Agent snapshot pro statusLine

Status line panel má segment `iq` který čte `~/.claude/cache/iq-state.json`.
Po rozhodnutí zapiš (overwrite) aktuální plán. Panel se zobrazí **jen pokud
je něco mimo default** — tj. máš `plannedAgents` nebo běží live agenti.

Formát souboru — mapa per sessionId + `_latest` fallback:

```json
{
  "_latest": { "ts": 1715683200000, "main": "opus 4.7", "plannedAgents": [{"model":"sonnet","role":"audit","count":1}] },
  "<sessionId>": { "ts": 1715683200000, "main": "opus 4.7", "plannedAgents": [] }
}
```

Doporučený zápis (jeden Bash call, node inline — atomic merge):

```bash
mkdir -p ~/.claude/cache && node -e "const fs=require('fs'),p=require('os').homedir()+'/.claude/cache/iq-state.json';let a={};try{a=JSON.parse(fs.readFileSync(p,'utf8'))}catch{};const s={ts:Date.now(),main:'opus 4.7',plannedAgents:[{model:'sonnet',role:'audit',count:1}]};a._latest=s;a['<sessionId>']=s;fs.writeFileSync(p,JSON.stringify(a));"
```

Pole `plannedAgents` může být prázdné — pokud žádné nedispatchuješ, snapshot ani
nezapisuj (panel by stejně nic neukázal).

## Logging

Po každém rozhodnutí appendni jeden řádek JSONL do
`~/.claude/logs/agent-decisions.jsonl`. Pokud složka `logs/` neexistuje, vytvoř ji.

Příklad (jeden line, žádný node parsing):

```bash
mkdir -p ~/.claude/logs && printf '%s\n' '{"ts":"2026-05-13T15:30:00Z","trigger":"writing-plans","main":"opus 4.7","agents":[{"model":"haiku","role":"explore","count":2}],"user_intent":"naplánuj refactor X"}' >> ~/.claude/logs/agent-decisions.jsonl
```

Klíče (povinné): `ts`, `trigger`, `main`, `agents` (array — může být prázdné),
`user_intent` (max 80 znaků, sanitizováno — žádné nové řádky, žádné apostrofy
které by rozbily shell).

Pokud appendnutí selže (disk full, perms), pokračuj bez něj — logování nesmí
blokovat odpověď.

## Triggery podle situace

- **Explicitní fráze o agentech** (viz frontmatter description) → invokovat.
- **Chystáš 2+ Agent dispatch v této odpovědi** → invokovat pro rozhodnutí
  modelů + zápis snapshotu.
- **User žádá plán který bude prováděn přes SDD** → invokovat (předem
  rozhoduješ jaké modely budou subagenty).
- **Plain implementace bez subagentů** → **neinvokovat**, nedělej snapshot.
- **Trivialita** (greeting, single Q, lookup, jednořádkový edit) → **neinvokovat**.

## Override pravidla

- User řekne "použij haiku všude" → další turn všechny agenty haiku, dokud se
  neukáže že kvalita nestačí.
- Skill se sám nezacyklí — pokud byl invokován v předchozím turnu a kontext se
  nemění, neinvokuj znova.
