#!/usr/bin/env node
// SessionStart: injektuje bohatý vizuální kontext (banner + git + sparkline + tip).
// Výstup jde do Claude kontextu jako `additionalContext` — proto BEZ ANSI barev,
// ale s unicode rámečky, emoji a markdown. Terminálová UI to renderuje čitelně.

const path = require('path');
const os = require('os');

const theme = require(path.join(os.homedir(), '.claude', 'lib', 'theme.js'));
const { gitInfo } = require(path.join(os.homedir(), '.claude', 'lib', 'git-info.js'));
const { projectInfo } = require(path.join(os.homedir(), '.claude', 'lib', 'project-info.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input || '{}'); } catch {}

  const cwd = data?.cwd || data?.workspace?.current_dir || process.cwd();
  const source = data?.source || 'startup';
  const config = theme.loadConfig();
  const g = theme.glyphs();

  const proj = projectInfo(cwd);
  const git = gitInfo(cwd);

  const parts = [];

  // Figlet banner — jen na startup a pokud je to git repo / reálný projekt, ne generic složka.
  const shouldBanner = config.banner.showFiglet
    && source === 'startup'
    && (git.inRepo || proj.hasPackageJson);

  if (shouldBanner) {
    const title = (proj.name || path.basename(cwd)).replace(/[^a-zA-Z0-9\- ]/g, '');
    if (title.length <= 14) {
      parts.push('```');
      parts.push(theme.figlet(title));
      parts.push('```');
    }
  }

  // Git panel
  if (git.inRepo) {
    const panelLines = [];
    const branchLine = `${g.branch} ${git.branch}`
      + (git.dirtyCount > 0 ? `${g.sep}${g.diff}${git.dirtyCount} dirty` : '')
      + (git.ahead > 0 ? `${g.sep}${g.up}${git.ahead} ahead` : '')
      + (git.behind > 0 ? `${g.sep}${g.down}${git.behind} behind` : '')
      + (!git.hasUpstream ? ' (no upstream)' : (git.ahead === 0 && git.behind === 0 && git.dirtyCount === 0 ? `${g.sep}sync` : ''));
    panelLines.push(branchLine);

    // Sparkline posledních commitů (pokud jsou)
    if (git.recentCommits && git.recentCommits.length > 0) {
      const sizes = git.recentCommits.map(c => c.additions + c.deletions).reverse();
      const spark = theme.sparkline(sizes);
      panelLines.push(`${g.doc} posledních ${git.recentCommits.length} commitů ${spark}`);

      const topN = git.recentCommits.slice(0, 3);
      for (const c of topN) {
        panelLines.push(`   ${c.hash} ${c.subject}`);
      }
    }

    if (git.dirtyCount > 0) {
      panelLines.push('');
      panelLines.push(`${g.note} ${git.dirtyCount} změn v pracovním stromu`);
    }

    if (config.banner.showWelcomeTip) {
      panelLines.push('');
      panelLines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }

    const panelTitle = proj.type && proj.type !== 'none'
      ? `${proj.name} · ${proj.type}`
      : proj.name;

    parts.push(theme.box({ title: panelTitle, lines: panelLines }));
  } else {
    // Není git repo
    const lines = [`${g.info} Složka není git repo`];
    if (config.banner.showWelcomeTip) {
      lines.push('');
      lines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
    parts.push(theme.box({ title: proj.name, lines }));
  }

  const context = parts.join('\n');

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }));
  process.exit(0);
});
