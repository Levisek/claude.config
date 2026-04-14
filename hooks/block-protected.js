#!/usr/bin/env node
// PreToolUse (Write/Edit): blokuje modifikaci citlivých souborů.

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const path = (data?.tool_input?.file_path || '').replace(/\\/g, '/').toLowerCase();
  if (!path) process.exit(0);

  // Měkké (ask): vyskočí permission prompt, rozhodneš ručně.
  const askPatterns = [
    { re: /(^|\/)\.env($|\.|\/)/, why: '.env soubor' },
  ];
  // Tvrdé (deny): žádný prompt, hard block.
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
    if (re.test(path)) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `Citlivý soubor (${why}) — potvrď ručně`
        }
      }));
      process.exit(0);
    }
  }

  for (const { re, why } of denyPatterns) {
    if (re.test(path)) {
      process.stderr.write(`🔒 Zablokováno: ${why}\nCesta: ${data.tool_input.file_path}\nPokud to opravdu chceš upravit, udělej to ručně mimo Claude.\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
