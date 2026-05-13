const test = require('node:test');
const assert = require('node:assert');
const { aggregate } = require('./agent-stats.js');

test('aggregate sečte modely subagentů', () => {
  const lines = [
    { ts: 't1', trigger: 'x', main: 'opus', agents: [{ model: 'haiku', role: 'grep', count: 2 }] },
    { ts: 't2', trigger: 'x', main: 'opus', agents: [{ model: 'haiku', role: 'find', count: 1 }, { model: 'sonnet', role: 'review', count: 1 }] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.agentCounts.haiku, 3);
  assert.strictEqual(result.agentCounts.sonnet, 1);
  assert.strictEqual(result.agentCounts.opus || 0, 0);
});

test('aggregate top triggery', () => {
  const lines = [
    { ts: 't', trigger: 'writing-plans', main: 'opus', agents: [] },
    { ts: 't', trigger: 'writing-plans', main: 'opus', agents: [] },
    { ts: 't', trigger: 'explicit-down', main: 'opus', agents: [] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.triggerCounts['writing-plans'], 2);
  assert.strictEqual(result.triggerCounts['explicit-down'], 1);
});

test('aggregate normalizuje case modelů', () => {
  const lines = [
    { ts: 't', main: 'opus', agents: [{ model: 'Haiku', count: 1 }] },
    { ts: 't', main: 'opus', agents: [{ model: 'HAIKU', count: 2 }] },
    { ts: 't', main: 'opus', agents: [{ model: 'haiku', count: 1 }] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.agentCounts.haiku, 4);
});

test('aggregate ignoruje malformed entries', () => {
  const lines = [null, 'string', { ts: 't', main: 'opus' }, undefined];
  const result = aggregate(lines);
  assert.strictEqual(result.totalTurns, 1);
});

test('aggregate počítá main model usage', () => {
  const lines = [
    { ts: 't', main: 'opus 4.7', agents: [] },
    { ts: 't', main: 'opus 4.7', agents: [] },
    { ts: 't', main: 'sonnet 4.6', agents: [] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.mainCounts['opus 4.7'], 2);
  assert.strictEqual(result.mainCounts['sonnet 4.6'], 1);
});
