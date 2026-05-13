const test = require('node:test');
const assert = require('node:assert');
const { inferModel } = require('./model-resolver.js');

test('Explore subagent → haiku (search/grep mechanic)', () => {
  assert.strictEqual(inferModel({ subagent_type: 'Explore', description: 'find files' }), 'haiku');
});

test('statusline-setup → haiku', () => {
  assert.strictEqual(inferModel({ subagent_type: 'statusline-setup' }), 'haiku');
});

test('Plan subagent → opus', () => {
  assert.strictEqual(inferModel({ subagent_type: 'Plan', description: 'architect refactor' }), 'opus');
});

test('general-purpose review → sonnet', () => {
  assert.strictEqual(inferModel({ subagent_type: 'general-purpose', description: 'review auth flow' }), 'sonnet');
  assert.strictEqual(inferModel({ subagent_type: 'general-purpose', description: 'audit security' }), 'sonnet');
  assert.strictEqual(inferModel({ subagent_type: 'general-purpose', description: 'posuď to' }), 'sonnet');
});

test('general-purpose implement multi-file → sonnet', () => {
  assert.strictEqual(
    inferModel({ subagent_type: 'general-purpose', description: 'implement gdpr consent across components' }),
    'sonnet'
  );
});

test('general-purpose implement mechanic → haiku', () => {
  assert.strictEqual(
    inferModel({ subagent_type: 'general-purpose', description: 'mechanic implement: rename variable in 1 file' }),
    'haiku'
  );
  assert.strictEqual(
    inferModel({ subagent_type: 'general-purpose', description: 'trivial fix typo' }),
    'haiku'
  );
});

test('general-purpose default → sonnet (safe fallback)', () => {
  assert.strictEqual(
    inferModel({ subagent_type: 'general-purpose', description: 'do something complex' }),
    'sonnet'
  );
});

test('SDD spec reviewer → haiku', () => {
  assert.strictEqual(
    inferModel({ subagent_type: 'general-purpose', description: 'SDD spec review for T1.2' }),
    'haiku'
  );
});

test('SDD quality reviewer → sonnet', () => {
  assert.strictEqual(
    inferModel({ description: 'code quality review for implementation' }),
    'sonnet'
  );
});

test('SDD implementer keyword → sonnet (multi-file default)', () => {
  assert.strictEqual(
    inferModel({ description: 'implementer for T2.1 gdpr' }),
    'sonnet'
  );
});

test('SDD implementer s mechanic hint → haiku', () => {
  assert.strictEqual(
    inferModel({ description: 'implementer mechanic T3.4 1 soubor' }),
    'haiku'
  );
});

test('architecture/design keyword → opus', () => {
  assert.strictEqual(inferModel({ description: 'architect new auth module' }), 'opus');
  assert.strictEqual(inferModel({ description: 'design caching layer' }), 'opus');
});

test('unknown role → null (fallback)', () => {
  assert.strictEqual(inferModel({ subagent_type: 'unknown-type', description: 'random task' }), null);
});

test('null/empty input → null', () => {
  assert.strictEqual(inferModel(null), null);
  assert.strictEqual(inferModel({}), null);
  assert.strictEqual(inferModel({ subagent_type: '', description: '' }), null);
});

test('prompt obsah ovlivňuje rozhodnutí', () => {
  // Mechanic v promptu by mělo srazit na haiku i u general-purpose implement
  assert.strictEqual(
    inferModel({
      subagent_type: 'general-purpose',
      description: 'implement check',
      prompt: 'This is a mechanic task: just add a new constant',
    }),
    'haiku'
  );
});

test('case-insensitive matching', () => {
  assert.strictEqual(
    inferModel({ subagent_type: 'GENERAL-PURPOSE', description: 'REVIEW security' }),
    'sonnet'
  );
  assert.strictEqual(
    inferModel({ description: 'IMPLEMENTER for T1' }),
    'sonnet'
  );
});
