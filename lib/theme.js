// Sdílená vizuální vrstva pro hooks, statusline, commands.
// Načte ~/.claude/theme-config.json (fallback default), exportuje primitiva.

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.claude', 'theme-config.json');
const DEFAULT_CONFIG = {
  theme: 'default',
  statusLine: {
    segments: ['project', 'git', 'tsc', 'context', 'cost'],
    separator: 'default',
  },
  banner: {
    showFiglet: true,
    showWelcomeTip: true,
  },
};

let cachedConfig = null;
function loadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    cachedConfig = { ...DEFAULT_CONFIG, ...parsed, statusLine: { ...DEFAULT_CONFIG.statusLine, ...(parsed.statusLine || {}) }, banner: { ...DEFAULT_CONFIG.banner, ...(parsed.banner || {}) } };
  } catch {
    cachedConfig = DEFAULT_CONFIG;
  }
  return cachedConfig;
}

function activeTheme() {
  const t = loadConfig().theme;
  return ['default', 'nerd', 'plain'].includes(t) ? t : 'default';
}

const palette = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
};

const GLYPH_SETS = {
  default: {
    boxTL: '╭', boxTR: '╮', boxBL: '╰', boxBR: '╯', boxH: '─', boxV: '│',
    check: '✓', cross: '✗', warn: '⚠', info: 'ℹ', shield: '🛡',
    arrow: '▸', bullet: '•', diff: '±', up: '↑', down: '↓',
    branch: '🌿', doc: '📜', note: '📝', pin: '📍', bulb: '💡', lock: '🔒',
    sparks: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
    sep: ' · ',
    barFilled: '█', barEmpty: '░',
  },
  nerd: {
    boxTL: '╭', boxTR: '╮', boxBL: '╰', boxBR: '╯', boxH: '─', boxV: '│',
    check: '\uf00c', cross: '\uf00d', warn: '\uf071', info: '\uf05a', shield: '\uf132',
    arrow: '\uf061', bullet: '•', diff: '±', up: '\uf062', down: '\uf063',
    branch: '\ue0a0', doc: '\uf15c', note: '\uf044', pin: '\uf041', bulb: '\uf0eb', lock: '\uf023',
    sparks: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
    sep: ' \ue0b1 ',
    barFilled: '█', barEmpty: '░',
  },
  plain: {
    boxTL: '+', boxTR: '+', boxBL: '+', boxBR: '+', boxH: '-', boxV: '|',
    check: 'v', cross: 'x', warn: '!', info: 'i', shield: '#',
    arrow: '>', bullet: '*', diff: '+/-', up: '^', down: 'v',
    branch: '[git]', doc: '[log]', note: '[!]', pin: '[@]', bulb: '[tip]', lock: '[!!]',
    sparks: ['.', '-', '-', '=', '=', '#', '#', '#'],
    sep: ' | ',
    barFilled: '#', barEmpty: '.',
  },
};

function glyphs() {
  return GLYPH_SETS[activeTheme()];
}

function colorsEnabled() {
  if (process.env.NO_COLOR) return false;
  if (activeTheme() === 'plain') return false;
  return true;
}

function color(text, name) {
  if (!colorsEnabled()) return text;
  const code = palette[name];
  if (!code) return text;
  return `${code}${text}${palette.reset}`;
}

// Strip ANSI escape codes pro výpočet šířky.
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// Přibližná šířka znaku — emojis a CJK = 2, zbytek = 1.
function charWidth(cp) {
  if (cp === 0) return 0;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  // Emoji ranges (zjednodušené)
  if (cp >= 0x1f300 && cp <= 0x1faff) return 2;
  if (cp >= 0x2600 && cp <= 0x27bf) return 2;
  if (cp >= 0x1f000 && cp <= 0x1f2ff) return 2;
  // CJK
  if (cp >= 0x1100 && cp <= 0x115f) return 2;
  if (cp >= 0x2e80 && cp <= 0x9fff) return 2;
  if (cp >= 0xa000 && cp <= 0xa4cf) return 2;
  if (cp >= 0xac00 && cp <= 0xd7a3) return 2;
  if (cp >= 0xf900 && cp <= 0xfaff) return 2;
  if (cp >= 0xfe30 && cp <= 0xfe4f) return 2;
  if (cp >= 0xff00 && cp <= 0xff60) return 2;
  if (cp >= 0xffe0 && cp <= 0xffe6) return 2;
  return 1;
}

function visibleWidth(s) {
  const clean = stripAnsi(s);
  let w = 0;
  for (const ch of clean) w += charWidth(ch.codePointAt(0));
  return w;
}

function padRight(s, targetWidth) {
  const diff = targetWidth - visibleWidth(s);
  return diff > 0 ? s + ' '.repeat(diff) : s;
}

// box({ title, lines, color?, padX? })
function box({ title = '', lines = [], color: boxColor = null, padX = 2, minWidth = 0 }) {
  const g = glyphs();
  const innerLines = Array.isArray(lines) ? lines : [lines];

  const titleDecorated = title ? ` ${title} ` : '';
  const titleWidth = visibleWidth(titleDecorated);
  const longestLine = innerLines.reduce((m, l) => Math.max(m, visibleWidth(l)), 0);
  const innerWidth = Math.max(longestLine + padX * 2, titleWidth + 4, minWidth);

  const c = (s) => boxColor ? color(s, boxColor) : s;

  const topBar = g.boxH.repeat(Math.max(innerWidth - titleWidth - 1, 1));
  const top = c(g.boxTL + g.boxH + titleDecorated + topBar + g.boxTR);
  const bottom = c(g.boxBL + g.boxH.repeat(innerWidth) + g.boxBR);

  const body = innerLines.map(l => {
    const content = ' '.repeat(padX) + l;
    return c(g.boxV) + padRight(content, innerWidth) + c(g.boxV);
  });

  return [top, ...body, bottom].join('\n');
}

function progressBar(percent, width = 10) {
  const g = glyphs();
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * width);
  return g.barFilled.repeat(filled) + g.barEmpty.repeat(width - filled);
}

function sparkline(numbers) {
  const g = glyphs();
  if (!numbers || numbers.length === 0) return '';
  const vals = numbers.map(n => Math.log1p(Math.max(0, n)));
  const max = Math.max(...vals, 0.0001);
  return vals.map(v => {
    const idx = Math.min(g.sparks.length - 1, Math.floor((v / max) * (g.sparks.length - 1)));
    return g.sparks[idx];
  }).join('');
}

// pipe([{text, color}, ...]) → "a · b · c" s barvami a separátorem z tématu
function pipe(segments) {
  const g = glyphs();
  const sepDim = color(g.sep, 'gray');
  return segments
    .filter(s => s && s.text)
    .map(s => s.color ? color(s.text, s.color) : s.text)
    .join(sepDim);
}

// Hardcoded slant figlet pro banner (6 řádků). Jen A-Z, 0-9, space, pomlčka.
const FIGLET_SLANT = {
  ' ': ['    ', '    ', '    ', '    ', '    ', '    '],
  '-': ['       ', '       ', '  ___  ', '       ', '       ', '       '],
  '.': ['   ', '   ', '   ', '   ', ' _ ', '(_)'],
  '_': ['        ', '        ', '        ', '        ', '        ', '_______ '],
  A: ['    ___ ', '   /   |', '  / /| |', ' / ___ |', '/_/  |_|', '        '],
  B: [' ____  ', '/ __ \\ ', '/ /_/ /', '/ __  / ', '/_/ /_/ ', '        '],
  C: ['   ____', '  / __/', ' / /   ', '/ /___ ', '\\____/ ', '        '],
  D: [' ____  ', '/ __ \\ ', '/ / / /', '/ /_/ / ', '/_____/ ', '        '],
  E: [' ______', '/ ____/', '/ __/  ', '/ /___  ', '/_____/ ', '        '],
  F: [' ______', '/ ____/', '/ /_   ', '/ __/   ', '/_/     ', '        '],
  G: ['   ____ ', '  / __ \\', ' / / _ `/', '/ /_/ / ', '\\____/  ', '        '],
  H: ['  __  __', ' / / / /', '/ /_/ / ', '/ __  /  ', '/_/ /_/  ', '        '],
  I: ['   ____ ', '  /  _/ ', '  / /   ', ' _/ /   ', '/___/   ', '        '],
  J: ['     __', '    / /', '   / / ', ' _/ /   ', '/___/   ', '        '],
  K: ['  __ __', ' / //_/', '/ ,<   ', '/ /| |  ', '/_/ |_|  ', '        '],
  L: ['  __   ', ' / /   ', '/ /    ', '/ /___  ', '/_____/ ', '        '],
  M: ['    __  ___', '   /  |/  /', '  / /|_/ / ', ' / /  / /   ', '/_/  /_/    ', '           '],
  N: ['   _   __', '  / | / /', ' /  |/ / ', '/ /|  /   ', '/_/ |_/    ', '          '],
  O: ['   ____ ', '  / __ \\', ' / / / /', '/ /_/ / ', '\\____/  ', '        '],
  P: [' ____ ', '/ __ \\', '/ /_/ /', '/ ____/ ', '/_/     ', '        '],
  Q: ['   ____ ', '  / __ \\', ' / / / /', '/ /_/ / ', '\\___\\_\\ ', '        '],
  R: [' ____ ', '/ __ \\', '/ /_/ /', '/ _, _/  ', '/_/ |_|  ', '         '],
  S: ['   _____', '  / ___/', '  \\__ \\ ', ' ___/ /  ', '/____/   ', '         '],
  T: ['  ______', ' /_  __/', '  / /   ', ' / /     ', '/_/      ', '         '],
  U: ['  __  __', ' / / / /', '/ / / / ', '/ /_/ /  ', '\\____/   ', '         '],
  V: ['_   __', '\\ \\ / /', ' \\ V / ', '  \\ /   ', '   v     ', '         '],
  W: ['__      __', '\\ \\ /\\ / /', ' \\ V  V / ', '  \\_/\\_/   ', '           ', '           '],
  X: [' _  __', '| |/_/', '_>  <  ', '/_/|_|  ', '        ', '        '],
  Y: ['__  __', '\\ \\/ /', ' \\  / ', ' / /    ', '/_/     ', '        '],
  Z: [' ____', '/_  /', ' / /_', '/___/   ', '        ', '        '],
  '0': ['   ___ ', '  / _ \\', ' / // /', '/ // / ', '\\___/  ', '       '],
  '1': ['  ___', ' <  /', ' / / ', '/ /   ', '/_/   ', '      '],
  '2': ['   ___ ', '  |_  |', ' / __/ ', '/ __/   ', '/____/  ', '        '],
  '3': ['   ____', '  |__ /', ' |_ \\  ', '___/ /  ', '/____/  ', '        '],
  '4': ['   __ ', '  / /_', ' / // ', '/__ _/', '  /_/  ', '       '],
  '5': ['   ____', '  / __/', ' /__ \\ ', '/____/ ', '       ', '       '],
  '6': ['   _____', '  / ___/', ' / __ \\ ', '/ /_/ / ', '\\____/  ', '        '],
  '7': ['  ____', ' /__  /', '  / / ', ' / /   ', '/_/    ', '       '],
  '8': ['   ___ ', '  ( _ )', ' / _  |', '/ /_/ / ', '\\____/  ', '        '],
  '9': ['   ___ ', '  / _ \\', ' /\\_, /', '/___/  ', '        ', '        '],
};

function figlet(text) {
  const s = String(text).toUpperCase();
  const rows = ['', '', '', '', '', ''];
  for (const ch of s) {
    const glyph = FIGLET_SLANT[ch] || FIGLET_SLANT[' '];
    for (let i = 0; i < 6; i++) rows[i] += glyph[i];
  }
  return rows.join('\n');
}

module.exports = {
  palette,
  glyphs,
  activeTheme,
  color,
  colorsEnabled,
  stripAnsi,
  visibleWidth,
  padRight,
  box,
  progressBar,
  sparkline,
  pipe,
  figlet,
  loadConfig,
  CONFIG_PATH,
  DEFAULT_CONFIG,
};
