#!/usr/bin/env node
// Tests encodeRepoPath matches Anthropic's projects/<encoded>/ naming convention.

const path = require('path');
const os = require('os');

const { encodeRepoPath } = require(path.join(os.homedir(), '.claude', 'lib', 'repo-path.js'));

const cases = [
  { in: 'C:\\Users\\admin\\.claude',                  out: 'C--Users-admin--claude' },
  { in: 'C:\\dev\\FPLPro',                            out: 'C--dev-FPLPro' },
  { in: 'C:\\dev\\_Gral_Aitomated web builder',       out: 'C--dev--Gral-Aitomated-web-builder' },
  { in: 'C:\\dev\\Tabulka MS',                        out: 'C--dev-Tabulka-MS' },
  { in: 'C:\\Windows\\System32',                      out: 'C--Windows-System32' },
];

let failed = 0;
for (const c of cases) {
  const got = encodeRepoPath(c.in);
  if (got === c.out) {
    console.log(`PASS  ${c.in}  →  ${got}`);
  } else {
    console.error(`FAIL  ${c.in}  →  got "${got}", expected "${c.out}"`);
    failed++;
  }
}
process.exit(failed > 0 ? 1 : 0);
