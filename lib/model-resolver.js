// Routing: podle subagent_type + description + prompt vrať doporučený model.
// Návratová hodnota null = nedoplňovat, nech agent inheritance default.
//
// Konzumuje track-agents.js (PreToolUse hook) — pokud Agent tool call nemá
// explicit `model`, hook ho doplní hodnotou z této funkce.
//
// Rubrika v CLAUDE.md (sekce *Subagent budget*):
//   - implementer mechanic / 1–2 soubory     → haiku
//   - implementer multi-file / integrace      → sonnet
//   - spec reviewer (žádný úsudek)            → haiku
//   - code/quality reviewer                   → sonnet
//   - final code reviewer (celé)              → sonnet (rozsáhlé → opus)
//   - architecture / design / plan            → opus

function inferModel(ti) {
  if (!ti || typeof ti !== 'object') return null;
  const sub = String(ti.subagent_type || '').toLowerCase();
  const desc = String(ti.description || '').toLowerCase();
  const prompt = String(ti.prompt || '').toLowerCase().slice(0, 500);
  const blob = sub + ' ' + desc + ' ' + prompt;

  // Známé subagent typy s pevným routingem
  if (sub === 'explore') return 'haiku';          // search/grep — mechanic
  if (sub === 'statusline-setup') return 'haiku';
  if (sub === 'plan') return 'opus';              // design judgment

  // Nejdřív zkontroluj specifické SDD role keywords (před obecnými review/implement
  // pravidly — "spec review" musí padnout na haiku, ne na sonnet z general 'review').
  if (/spec.{0,5}review/.test(blob)) return 'haiku';
  if (/quality.{0,5}review/.test(blob)) return 'sonnet';
  if (/code.{0,5}review|final.{0,5}review/.test(blob)) return 'sonnet';

  // general-purpose default branch — obecnější pravidla
  if (sub === 'general-purpose') {
    if (/review|audit|critique|posu[dz]/.test(blob)) return 'sonnet';
    if (/implement|napsat|vytvo[řr]it|p[řr]idat|fix|opravit/.test(blob)) {
      if (/mechanic|trivial|jednoduch|lookup|grep|find|hled|po[čc]ítej|count/.test(blob)) return 'haiku';
      return 'sonnet';
    }
    return 'sonnet'; // safe default pro general-purpose
  }

  // Custom subagent_type — routing podle keywords v description/prompt
  if (/implementer|implement/.test(blob)) {
    if (/mechanic|trivial|jednoduch|1[- ]?2.?soubor/.test(blob)) return 'haiku';
    return 'sonnet';
  }
  if (/architect|design|plan/.test(blob)) return 'opus';

  // Fallback — nedoplňovat, nech agent default
  return null;
}

module.exports = { inferModel };
