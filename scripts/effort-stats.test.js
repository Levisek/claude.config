const test = require('node:test');
const assert = require('node:assert');
const { aggregate } = require('./effort-stats.js');

test('aggregate vrátí počty effortu', () => {
  const lines = [
    { ts: '2026-05-13T10:00:00Z', trigger: 'writing-plans', effort: 99, main: 'opus', agents: [] },
    { ts: '2026-05-13T10:05:00Z', trigger: 'explicit', effort: 75, main: 'opus', agents: [] },
    { ts: '2026-05-13T10:10:00Z', trigger: 'explicit', effort: 75, main: 'opus', agents: [] },
    { ts: '2026-05-13T10:15:00Z', trigger: 'auto', effort: 60, main: 'opus', agents: [] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.effortCounts[60], 1);
  assert.strictEqual(result.effortCounts[75], 2);
  assert.strictEqual(result.effortCounts[99], 1);
  assert.strictEqual(result.totalTurns, 4);
});

test('aggregate sečte modely subagentů', () => {
  const lines = [
    { ts: 't1', trigger: 'x', effort: 75, main: 'opus', agents: [{ model: 'haiku', role: 'grep', count: 2 }] },
    { ts: 't2', trigger: 'x', effort: 75, main: 'opus', agents: [{ model: 'haiku', role: 'find', count: 1 }, { model: 'sonnet', role: 'review', count: 1 }] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.agentCounts.haiku, 3);
  assert.strictEqual(result.agentCounts.sonnet, 1);
  assert.strictEqual(result.agentCounts.opus || 0, 0);
});

test('aggregate top triggery', () => {
  const lines = [
    { ts: 't', trigger: 'writing-plans', effort: 99, main: 'opus', agents: [] },
    { ts: 't', trigger: 'writing-plans', effort: 99, main: 'opus', agents: [] },
    { ts: 't', trigger: 'explicit-down', effort: 60, main: 'opus', agents: [] },
  ];
  const result = aggregate(lines);
  assert.strictEqual(result.triggerCounts['writing-plans'], 2);
  assert.strictEqual(result.triggerCounts['explicit-down'], 1);
});
