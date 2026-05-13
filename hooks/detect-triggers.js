#!/usr/bin/env node
// UserPromptSubmit hook — auto-detect signály pro token-aware skill.
// Pokud user message obsahuje klíčová slova naznačující plánovaný dispatch
// subagentů, injectne do kontextu reminder s routing tabulkou.
//
// Tichá chyba — nesmí blokovat user prompt.

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const prompt = String(data?.prompt || '').toLowerCase();
  if (!prompt) process.exit(0);

  // Klíčová slova naznačující plánovaný dispatch / multi-agent / netriviální plán
  // (česky + anglicky, lowercased pattern)
  const triggers = [
    // agent dispatch
    'rozdělej', 'rozděl to', 'naplánuj', 'naplán', 'agenti', 'agent ', 'agents',
    'subagent', 'sdd', 'subagent-driven', 'parallel', 'paralelně', 'parallel',
    'použij haiku', 'use haiku', 'cheap agent', 'levné agent',
    // plánování / design
    ' plán', 'navrhni', 'navrhnout', 'design ', 'spec ', 'specifikuj',
    'roadmap', 'architecture', 'architekturu',
    // refactor / multi-soubor
    'refactor', 'přepiš', 'rewrite', 'multi-soubor', 'multi-file',
    // explicitní invokace
    'token-aware', 'jaký model', 'what model', 'which agents',
  ];

  let matched = null;
  for (const t of triggers) {
    if (prompt.includes(t)) { matched = t; break; }
  }

  if (!matched) process.exit(0);

  const additionalContext = `[auto-trigger: "${matched}"] User message naznačuje plánovaný dispatch subagentů nebo netriviální plán. Před dispatchem:

1. **Invokuj skill token-aware** (jednou za turn, ne opakovaně) — vyhodnotí strategii a zapíše snapshot pro status panel.
2. **Routing tabulka** (CLAUDE.md: Subagent budget):
   - implementer (mechanický, 1–2 soubory) → haiku
   - implementer (multi-file, integrace) → sonnet
   - spec reviewer → haiku
   - code/final reviewer → sonnet (rozsáhlé → opus)
3. **Vždy předávej model: parametr explicitně** v Agent tool calls — bez něj agent zdědí parent (opus) = drahé.
4. Pro 3+ tasků: SDD parallel batch mode je DEFAULT (viz CLAUDE.md).

Pokud user signál byl false-positive (např. mluví o agentech jako konceptu, ne o dispatchi), ignoruj.`;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  }));

  process.exit(0);
});
