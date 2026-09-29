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

  // levis-usage.json je jeden sdílený soubor — zapisuje ho statusline té
  // session, která zrovna běžela naposled. Chat přes SDK statusline nespouští,
  // takže by tu četl cizí čísla (2026-09-26: čerstvá session dostala „801k“
  // z jiné, otevřené v terminálu). Cizí data ignoruj a vezmi velikost
  // kontextu z vlastního přepisu — jinak hook v chatu LevisIDE mlčel vždycky.
  let inputTokens = 0;
  try {
    const usage = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8'));
    if (usage?.raw?.session_id === sessionId) {
      inputTokens = Number(usage?.raw?.context_window?.total_input_tokens || 0);
    }
  } catch {}
  if (!inputTokens) inputTokens = kontextZPrepisu(data?.transcript_path);
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
  // Kontext se skoro celý čte z cache: Opus 5.5 cache read $0,20/Mtok.
  // Plná cena vstupu ($4–5) by odhad nafoukla dvacetkrát.
  const costPerTurn = (inputTokens / 1_000_000 * 0.2).toFixed(2);

  let msg;
  if (level === 'hard') {
    msg = `<context-pressure level="hard">
Context window: **${kTokens}k input tokens** (~$${costPerTurn} per API call at Opus 5.5 cache-read rates).
Recommend running \`/compact\` NOW — cost grows linearly with context size.
In your next response, suggest to the user: "Doporučuju spustit /compact, kontext je u ${kTokens}k."
</context-pressure>`;
  } else {
    msg = `<context-pressure level="soft">
Context window: **${kTokens}k input tokens** (~$${costPerTurn} per API call at Opus 5.5 cache-read rates).
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

// Velikost kontextu = vstup poslední odpovědi hlavní konverzace (bez
// subagentů). Čte se jen konec souboru — přepis mívá desítky MB.
function kontextZPrepisu(cesta) {
  if (!cesta) return 0;
  let text;
  try {
    const fd = fs.openSync(cesta, 'r');
    try {
      const velikost = fs.fstatSync(fd).size;
      const delka = Math.min(velikost, 512 * 1024);
      const buf = Buffer.alloc(delka);
      fs.readSync(fd, buf, 0, delka, velikost - delka);
      text = buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return 0; }
  const radky = text.split('\n');
  for (let i = radky.length - 1; i >= 0; i--) {
    if (!radky[i].includes('"type":"assistant"')) continue;
    let z;
    try { z = JSON.parse(radky[i]); } catch { continue; } // první řádek bývá useknutý
    if (z?.type !== 'assistant' || z.isSidechain) continue;
    const u = z.message?.usage;
    if (!u) continue;
    return Number(u.input_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0);
  }
  return 0;
}
