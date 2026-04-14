#!/usr/bin/env node
// SessionStart: injektuje git kontext (branch, ahead/behind, posl. commity, dirty).

const { execSync } = require('child_process');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { data = {}; }
  const cwd = data?.cwd || process.cwd();

  const run = (cmd) => {
    try {
      return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { return null; }
  };

  // Jsi v git repu?
  const isGit = run('git rev-parse --is-inside-work-tree') === 'true';
  if (!isGit) process.exit(0);

  const branch = run('git branch --show-current') || '(detached)';
  const status = run('git status --short') || '';
  const dirtyLines = status ? status.split('\n').filter(Boolean) : [];
  const dirtyCount = dirtyLines.length;

  const ahead = run('git rev-list --count @{u}..HEAD 2>/dev/null') || '0';
  const behind = run('git rev-list --count HEAD..@{u} 2>/dev/null') || '0';
  const hasUpstream = run('git rev-parse --abbrev-ref @{u} 2>/dev/null');

  const lastCommits = run('git log --oneline -3') || '';

  let syncInfo = '(no upstream)';
  if (hasUpstream) {
    if (ahead === '0' && behind === '0') syncInfo = 'sync';
    else syncInfo = `ahead ${ahead}, behind ${behind}`;
  }

  const lines = [];
  lines.push(`📍 Branch: \`${branch}\` (${syncInfo})`);
  if (dirtyCount > 0) {
    lines.push(`📝 Dirty: ${dirtyCount} soubor(ů)`);
    lines.push('```');
    lines.push(dirtyLines.slice(0, 8).join('\n'));
    if (dirtyLines.length > 8) lines.push(`... a dalších ${dirtyLines.length - 8}`);
    lines.push('```');
  } else {
    lines.push('✓ Pracovní strom čistý');
  }
  if (lastCommits) {
    lines.push('📜 Poslední commity:');
    lines.push('```');
    lines.push(lastCommits);
    lines.push('```');
  }

  const context = lines.join('\n');
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context
    }
  }));
  process.exit(0);
});
