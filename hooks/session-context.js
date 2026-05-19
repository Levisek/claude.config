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

  // Write SessionStart marker pro pozdější SessionEnd hook (jen na startup).
  const sessionId = data?.session_id || '';
  if (sessionId && source === 'startup') {
    const fs = require('fs');
    const markerPath = path.join(os.homedir(), '.claude', 'cache', `session-start-${sessionId}.json`);
    const marker = {
      ts: Date.now(),
      branch: git.branch || null,
      headSha: git.recentCommits?.[0]?.hash || null,
      cwd: cwd,
    };
    try {
      fs.mkdirSync(path.dirname(markerPath), { recursive: true });
      fs.writeFileSync(markerPath, JSON.stringify(marker));
    } catch {}
  }

  const parts = [];

  // Figlet banner — jen na startup a pokud je to git repo / reálný projekt, ne generic složka.
  const shouldBanner = config.banner.showFiglet
    && source === 'startup'
    && (git.inRepo || proj.hasPackageJson);

  // Sparkline jen na startup a compact (compact = Claude lost context, potřebuje orientaci).
  const shouldSparkline = source === 'startup' || source === 'compact';
  // Welcome tip jen na startup — resume/clear/compact znamenají, že user už ví co dělá.
  const shouldTip = source === 'startup' && config.banner.showWelcomeTip;

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

    // Sparkline posledních commitů (pokud jsou) — jen na startup/compact
    if (shouldSparkline && git.recentCommits && git.recentCommits.length > 0) {
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

    if (shouldTip) {
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
    if (shouldTip) {
      lines.push('');
      lines.push(`${g.info}  tip: napiš /welcome pro rychlý přehled Claude Code`);
    }
    parts.push(theme.box({ title: proj.name, lines }));
  }

  // Memory pull — na startup a compact, inject poslední session-log entry
  const shouldPullMemory = (source === 'startup' || source === 'compact') && git.inRepo;
  if (shouldPullMemory) {
    try {
      const fs = require('fs');
      const { encodeRepoPath } = require(path.join(os.homedir(), '.claude', 'lib', 'repo-path.js'));
      const logPath = path.join(os.homedir(), '.claude', 'projects', encodeRepoPath(cwd), 'memory', 'session-log.md');
      const raw = fs.readFileSync(logPath, 'utf8');
      // Extract last `## ...` block
      const lastIdx = raw.lastIndexOf('\n## ');
      const lastBlock = lastIdx >= 0 ? raw.slice(lastIdx + 1) : '';
      const trimmed = lastBlock.trim().slice(0, 500);
      if (trimmed) {
        parts.push('\n**Previous session:**\n' + trimmed);
      }
    } catch {}
  }

  // Compact replay — jen pro compact, inject pre-compact snapshot
  if (source === 'compact' && sessionId) {
    try {
      const fs = require('fs');
      const snapPath = path.join(os.homedir(), '.claude', 'cache', `pre-compact-${sessionId}.json`);
      const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
      const replayLines = [
        `**Pre-compact state** (compacted at ${new Date(snap.ts).toISOString()}):`,
      ];
      for (const c of (snap.recent_commits || []).slice(0, 3)) {
        replayLines.push(`- ${c.hash} ${c.subject}`);
      }
      replayLines.push(`- ${(snap.git_status || []).length} dirty files, ${(snap.recent_agents || []).length} recent agents`);
      parts.push('\n' + replayLines.join('\n'));
    } catch {}
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
