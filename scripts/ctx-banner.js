#!/usr/bin/env node
// Banner pro /ctx — barevný figlet s názvem projektu + stav panel.
// Bash tool output v Claude Code UI renderuje ANSI escape codes.

const path = require('path');
const os = require('os');

const theme = require(path.join(os.homedir(), '.claude', 'lib', 'theme.js'));
const { gitInfoLite } = require(path.join(os.homedir(), '.claude', 'lib', 'git-info.js'));
const { projectInfo } = require(path.join(os.homedir(), '.claude', 'lib', 'project-info.js'));

const cwd = process.argv[2] || process.cwd();
const proj = projectInfo(cwd);
const git = gitInfoLite(cwd);
const g = theme.glyphs();

// Vyber barvu banneru podle typu projektu
const typeColor = (t) => {
  const map = {
    'Next.js': 'brightBlue',
    'Electron': 'cyan',
    'Vite': 'brightMagenta',
    'Expo': 'brightCyan',
    'React Native': 'cyan',
    'React': 'brightCyan',
    'Vue': 'green',
    'Svelte': 'brightRed',
    'Node': 'green',
    'GRAL': 'brightYellow',
    'Vanilla web': 'yellow',
    'none': 'gray',
  };
  return map[t] || 'cyan';
};

// Název pro banner — sanitizovaný, upper, max ~14 znaků
const rawName = proj.name || path.basename(cwd);
const bannerText = rawName.replace(/[^a-zA-Z0-9\- ]/g, '').toUpperCase().slice(0, 14) || 'PROJECT';

const bannerColor = typeColor(proj.type);
const figletLines = theme.figlet(bannerText).split('\n');
const coloredBanner = figletLines.map(line => theme.color(line, bannerColor)).join('\n');

console.log('');
console.log(coloredBanner);

// Stav panel — barevně, přes ANSI
const statusLines = [];

const projectLine = `${theme.color('projekt', 'dim')}   ${theme.color(proj.name, 'bold')}` +
  (proj.type && proj.type !== 'none' ? `  ${theme.color('·', 'gray')}  ${theme.color(proj.type, bannerColor)}` : '') +
  `  ${theme.color('·', 'gray')}  ${theme.color(proj.language, 'dim')}`;
statusLines.push(projectLine);

if (git.inRepo) {
  const branchColor = git.behind > 0 ? 'red' : (git.dirtyCount > 0 || git.ahead > 0 ? 'yellow' : 'green');
  let gitText = theme.color(`${g.branch} ${git.branch}`, branchColor);
  if (git.dirtyCount > 0) gitText += theme.color(`  ${g.diff}${git.dirtyCount}`, 'yellow');
  if (git.ahead > 0) gitText += theme.color(`  ${g.up}${git.ahead}`, 'green');
  if (git.behind > 0) gitText += theme.color(`  ${g.down}${git.behind}`, 'red');
  if (!git.hasUpstream) gitText += theme.color('  (no upstream)', 'dim');
  else if (git.ahead === 0 && git.behind === 0 && git.dirtyCount === 0) gitText += theme.color('  sync', 'green');
  statusLines.push(`${theme.color('git    ', 'dim')} ${gitText}`);
} else {
  statusLines.push(`${theme.color('git    ', 'dim')} ${theme.color('není git repo', 'gray')}`);
}

if (proj.hasTsconfig) {
  statusLines.push(`${theme.color('tsc    ', 'dim')} ${theme.color('TS projekt', 'brightCyan')} ${theme.color('(spusť /tsc pro check)', 'dim')}`);
}

console.log(theme.box({
  title: theme.color('stav', 'bold'),
  lines: statusLines,
  color: 'gray',
}));
console.log('');
