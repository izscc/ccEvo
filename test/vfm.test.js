'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeVScore,
  isWorthEvolving,
  scoreFrequency,
  scoreFailReduction,
  scoreUserBurden,
  EVOLUTION_THRESHOLD,
} = require('../src/vfm/scorer');
const { mutateWeights, DEFAULT_WEIGHTS, WEIGHT_MIN, WEIGHT_MAX } = require('../src/vfm/mutator');

describe('vfm scorer', () => {
  it('scoreFrequency returns 0 for zero triggers', () => {
    assert.strictEqual(scoreFrequency({ trigger_count: 0 }), Math.log2(1));
  });

  it('scoreFrequency caps at 10', () => {
    const score = scoreFrequency({ trigger_count: 999999 });
    assert.ok(score <= 10);
  });

  it('scoreFailReduction returns 0 for no capsules', () => {
    assert.strictEqual(scoreFailReduction({ linked_genes: ['g1'] }, []), 0);
  });

  it('scoreFailReduction returns 10 for 100% success', () => {
    const cap = { linked_genes: ['g1'] };
    const capsules = [
      { gene_id: 'g1', metrics: { validation_passed: true } },
      { gene_id: 'g1', metrics: { validation_passed: true } },
    ];
    assert.strictEqual(scoreFailReduction(cap, capsules), 10);
  });

  it('scoreUserBurden rewards linked skills', () => {
    const low = scoreUserBurden({ linked_skills: [], preconditions: ['a', 'b', 'c'] });
    const high = scoreUserBurden({ linked_skills: ['s1', 's2'], preconditions: [] });
    assert.ok(high > low);
  });

  it('computeVScore returns 0-100', () => {
    const cap = {
      trigger_count: 10,
      linked_genes: [],
      linked_skills: ['s1'],
      preconditions: [],
    };
    const score = computeVScore(cap, { capsules: [], events: [] });
    assert.ok(score >= 0 && score <= 100);
  });

  it('isWorthEvolving respects threshold', () => {
    assert.strictEqual(isWorthEvolving(EVOLUTION_THRESHOLD), true);
    assert.strictEqual(isWorthEvolving(EVOLUTION_THRESHOLD - 1), false);
  });
});

describe('vfm mutator', () => {
  it('returns weights within bounds', () => {
    const w = mutateWeights(DEFAULT_WEIGHTS, [], []);
    for (const key of Object.keys(w)) {
      assert.ok(w[key] >= WEIGHT_MIN, `${key} >= WEIGHT_MIN`);
      assert.ok(w[key] <= WEIGHT_MAX, `${key} <= WEIGHT_MAX`);
    }
  });

  it('increases failReduce on high failure rate', () => {
    const capsules = Array.from({ length: 5 }, () => ({
      metrics: { validation_passed: false },
      mutation_category: 'repair',
    }));
    const w = mutateWeights(DEFAULT_WEIGHTS, capsules, []);
    assert.ok(w.failReduce >= DEFAULT_WEIGHTS.failReduce);
  });

  it('adjusts on high success + low innovation', () => {
    const capsules = Array.from({ length: 10 }, () => ({
      metrics: { validation_passed: true },
      mutation_category: 'repair',
    }));
    const w = mutateWeights(DEFAULT_WEIGHTS, capsules, []);
    assert.ok(w.frequency >= DEFAULT_WEIGHTS.frequency);
  });
});
