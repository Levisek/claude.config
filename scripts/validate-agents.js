#!/usr/bin/env node
// Validates ~/.claude/agents/*.md files have required frontmatter.
// Exit 0 = all pass, 1 = at least one failure. Designed for CI + TDD loops.

const fs = require('fs');
const path = require('path');
const os = require('os');

const AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');

const EXPECTED = [
  { name: 'implementer-mech', model: 'haiku' },
  { name: 'implementer-multi', model: 'sonnet' },
  { name: 'spec-reviewer', model: 'haiku' },
  { name: 'code-reviewer', model: 'sonnet' },
  { name: 'dead-code-scanner', model: 'haiku' },
  { name: 'architect', model: 'opus' },
];

const REQUIRED_FIELDS = ['name', 'description', 'model', 'tools'];

function parseFrontmatter(content) {
  const match = content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

function validate() {
  const failures = [];

  if (!fs.existsSync(AGENTS_DIR)) {
    failures.push(`Directory not found: ${AGENTS_DIR}`);
    return failures;
  }

  for (const expected of EXPECTED) {
    const filePath = path.join(AGENTS_DIR, `${expected.name}.md`);
    if (!fs.existsSync(filePath)) {
      failures.push(`Missing file: ${expected.name}.md`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) {
      failures.push(`${expected.name}.md: no YAML frontmatter`);
      continue;
    }
    for (const field of REQUIRED_FIELDS) {
      if (!fm[field]) failures.push(`${expected.name}.md: missing field "${field}"`);
    }
    if (fm.name && fm.name !== expected.name) {
      failures.push(`${expected.name}.md: name field is "${fm.name}", expected "${expected.name}"`);
    }
    if (fm.model && fm.model !== expected.model) {
      failures.push(`${expected.name}.md: model is "${fm.model}", expected "${expected.model}"`);
    }
  }

  return failures;
}

const failures = validate();
if (failures.length === 0) {
  console.log(`OK — ${EXPECTED.length} agents validated.`);
  process.exit(0);
} else {
  console.error('FAIL:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
