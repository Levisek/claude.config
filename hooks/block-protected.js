#!/usr/bin/env node
// PreToolUse (Write/Edit): blokuje modifikaci citlivých souborů.

const path = require('path');
const os = require('os');
const theme = require(path.join(os.homedir(), '.claude', 'lib', 'theme.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const target = (data?.tool_input?.file_path || '').replace(/\\/g, '/').toLowerCase();
  if (!target) process.exit(0);

  const askPatterns = [
    { re: /(^|\/)\.env($|\.|\/)/, why: '.env soubor' },
  ];
  const denyPatterns = [
    { re: /\.pem$/, why: '*.pem soukromý klíč' },
    { re: /\.key$/, why: '*.key soubor' },
    { re: /\.ppk$/, why: '*.ppk (PuTTY klíč)' },
    { re: /(^|\/)id_rsa(\.|$)/, why: 'SSH klíč' },
    { re: /(^|\/)credentials?(\.|$)/, why: 'credentials soubor' },
    { re: /\.aws\/credentials/, why: 'AWS credentials' },
    { re: /(^|\/)secrets?\//, why: 'secrets/ složka' },
    { re: /(^|\/)\.ssh\//, why: '.ssh/ složka' },
    { re: /(^|\/)\.gnupg\//, why: '.gnupg/ složka' },
    { re: /\.(p12|pfx)$/, why: 'certifikát (p12/pfx)' },
  ];

  for (const { re, why } of askPatterns) {
    if (re.test(target)) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `Citlivý soubor (${why}) — potvrď ručně`,
        },
      }));
      process.exit(0);
    }
  }

  for (const { re, why } of denyPatterns) {
    if (re.test(target)) {
      const g = theme.glyphs();
      const box = theme.box({
        title: `${g.lock} BLOKOVÁNO · ${why}`,
        lines: [
          `Claude se pokusil upravit citlivý soubor.`,
          ``,
          `${theme.color('Cesta:', 'dim')} ${data.tool_input.file_path}`,
          ``,
          `${g.arrow} Pokud to opravdu chceš, uprav to ručně`,
          `  v editoru mimo Claude.`,
          ``,
          `${theme.color('Pravidlo:', 'dim')} ~/.claude/hooks/block-protected.js`,
        ],
        color: 'red',
      });
      process.stderr.write(box + '\n');
      process.exit(2);
    }
  }
  process.exit(0);
});
