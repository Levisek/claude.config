#!/usr/bin/env node
// PreToolUse (Bash): blokuje katastrofické příkazy.
// Exit 2 + stderr = block. Exit 0 = allow.

const path = require('path');
const os = require('os');
const theme = require(path.join(os.homedir(), '.claude', 'lib', 'theme.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const cmd = (data?.tool_input?.command || '').toLowerCase();
  if (!cmd) process.exit(0);

  const patterns = [
    { re: /\brm\s+-[a-z]*r[a-z]*f?\s+\/(\s|$)/, why: 'rm -rf /' },
    { re: /\brm\s+-[a-z]*r[a-z]*f?\s+\/\*/, why: 'rm -rf /*' },
    { re: /\brm\s+-[a-z]*r[a-z]*f?\s+(~|\$home)(\s|\/|$)/i, why: 'rm -rf home' },
    { re: /\brm\s+-[a-z]*r[a-z]*f?\s+c:[\\/]/i, why: 'rm -rf C:\\' },
    { re: /\bdrop\s+(table|database|schema)\b/, why: 'DROP TABLE/DATABASE' },
    { re: /\bdelete\s+from\s+\w+\s*;?\s*$/, why: 'DELETE FROM bez WHERE' },
    { re: /\bmkfs\b/, why: 'mkfs (formát disku)' },
    { re: /\bdd\s+.*\bof=\/dev\//, why: 'dd of=/dev/...' },
    { re: />\s*\/dev\/(sd[a-z]|nvme|hd[a-z])/, why: 'overwrite device' },
    { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/, why: 'fork bomb' },
    { re: /\bchmod\s+-[a-z]*r[a-z]*\s+777\s+\//, why: 'chmod -R 777 /' },
    { re: /\bformat\s+[a-z]:/i, why: 'format C:' },
    { re: /remove-item\s+.*-recurse.*-force.*[a-z]:\\/i, why: 'Remove-Item -Recurse -Force' },
    { re: /\bgit\s+push\s+.*--force\b/, why: 'git push --force' },
    { re: /\bgit\s+push\s+.*-f\b(?!\w)/, why: 'git push -f' },
    { re: /\bgit\s+reset\s+--hard\s+(head~|origin)/, why: 'git reset --hard' },
    { re: /\bgit\s+clean\s+-[a-z]*f/, why: 'git clean -f' },
    { re: /\bgit\s+checkout\s+\./, why: 'git checkout . (discard)' },
    { re: /\bgit\s+branch\s+-d\b/i, why: 'git branch -D' },
  ];

  for (const { re, why } of patterns) {
    if (re.test(cmd)) {
      const g = theme.glyphs();
      const box = theme.box({
        title: `${g.shield} BLOKOVÁNO · ${why}`,
        lines: [
          `Claude se pokusil spustit destruktivní příkaz.`,
          ``,
          `${theme.color('Příkaz:', 'dim')} ${data.tool_input.command}`,
          ``,
          `${g.arrow} Pokud to opravdu chceš, spusť to ručně`,
          `  v samostatném terminálu mimo Claude.`,
          ``,
          `${theme.color('Pravidlo:', 'dim')} ~/.claude/hooks/block-destructive.js`,
        ],
        color: 'red',
      });
      process.stderr.write(box + '\n');
      process.exit(2);
    }
  }
  process.exit(0);
});
