#!/usr/bin/env node
// UserPromptSubmit hook — sleduje context window usage z levis-usage.json
// a injektuje warning při překročení threshold. Once-per-threshold-per-session
// flag v cache/context-warned-<sessionId>.json — ať neotravuje pořád.
//
// Thresholdy (default):
//   150_000 tokens → soft warning (model doporučí /compact)
//   200_000 tokens → hard warning (urgent /compact reminder)
//
// Tichá chyba — nesmí blokovat user prompt.

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const USAGE_PATH = path.join(HOME, '.claude', 'levis-usage.json');
const CACHE_DIR = path.join(HOME, '.claude', 'cache');

const SOFT_THRESHOLD = 150_000;
const HARD_THRESHOLD = 200_000;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const sessionId = data?.session_id || '';
  if (!sessionId) process.exit(0);

  let usage;
  try { usage = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8')); } catch { process.exit(0); }

  const cw = usage?.raw?.context_window;
  if (!cw) process.exit(0);

  const inputTokens = Number(cw.total_input_tokens || 0);
  if (!inputTokens) process.exit(0);

  // Read warned-flags pro tuto session
  const flagPath = path.join(CACHE_DIR, `context-warned-${sessionId}.json`);
  let warned = { soft: false, hard: false };
  try { warned = { ...warned, ...JSON.parse(fs.readFileSync(flagPath, 'utf8')) }; } catch {}

  let level = null;
  if (inputTokens >= HARD_THRESHOLD && !warned.hard) {
    level = 'hard';
    warned.hard = true;
    warned.soft = true; // hard implies soft already crossed
  } else if (inputTokens >= SOFT_THRESHOLD && !warned.soft) {
    level = 'soft';
    warned.soft = true;
  }

  if (!level) process.exit(0);

  // Persist warned state
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(flagPath, JSON.stringify(warned));
  } catch {}

  const kTokens = Math.round(inputTokens / 1000);
  const costPerTurn = (inputTokens / 1_000_000 * 15).toFixed(2); // Opus input ~$15/Mtok

  let msg;
  if (level === 'hard') {
    msg = `<context-pressure level="hard">
Context window: **${kTokens}k input tokens** (~$${costPerTurn}/turn at Opus input rates).
Recommend running \`/compact\` NOW — cost grows linearly with context size.
In your next response, suggest to the user: "Doporučuju spustit /compact, kontext je u ${kTokens}k."
</context-pressure>`;
  } else {
    msg = `<context-pressure level="soft">
Context window: **${kTokens}k input tokens** (~$${costPerTurn}/turn at Opus input rates).
Consider suggesting \`/compact\` to the user if upcoming work doesn't need full history.
This reminder fires once per threshold per session — ignore if active task still needs context.
</context-pressure>`;
  }

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: msg,
    },
  }));
  process.exit(0);
});
