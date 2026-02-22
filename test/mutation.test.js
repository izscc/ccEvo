'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createMutation, checkStrategyAllowance, assessRisk } = require('../src/gep/mutation');

describe('mutation', () => {
  describe('createMutation', () => {
    it('creates a valid repair mutation', () => {
      const m = createMutation({
        category: 'repair',
        trigger_signals: ['log_error'],
        target: 'Fix crash bug',
        expected_effect: 'Crash will stop occurring',
      });
      assert.strictEqual(m.type, 'Mutation');
      assert.strictEqual(m.category, 'repair');
      assert.strictEqual(m.risk_level, 'low');
    });

    it('creates an innovate mutation with medium risk', () => {
      const m = createMutation({
        category: 'innovate',
        trigger_signals: ['user_feature_request'],
        target: 'Add search feature',
        expected_effect: 'Users can search through history',
      });
      assert.strictEqual(m.risk_level, 'medium');
    });

    it('throws on invalid category', () => {
      assert.throws(() => createMutation({
        category: 'invalid',
        target: 'x',
        expected_effect: 'y',
      }));
    });

    it('throws on missing target', () => {
      assert.throws(() => createMutation({
        category: 'repair',
        expected_effect: 'y',
      }));
    });
  });

  describe('checkStrategyAllowance', () => {
    it('allows mutation within strategy', () => {
      const result = checkStrategyAllowance('repair', { repair: 50, optimize: 30, innovate: 20 }, []);
      assert.strictEqual(result.allowed, true);
    });

    it('blocks mutation when strategy weight is 0', () => {
      const result = checkStrategyAllowance('innovate', { repair: 80, optimize: 20, innovate: 0 }, []);
      assert.strictEqual(result.allowed, false);
    });

    it('blocks when ratio exceeds target by >20%', () => {
      const history = Array.from({ length: 10 }, () => ({ category: 'repair' }));
      const result = checkStrategyAllowance('repair', { repair: 20, optimize: 40, innovate: 40 }, history);
      assert.strictEqual(result.allowed, false);
    });
  });

  describe('assessRisk', () => {
    it('returns base risk for small changes', () => {
      const m = { category: 'repair' };
      const r = assessRisk(m, { files: 2, lines: 50 });
      assert.strictEqual(r.risk, 'low');
      assert.strictEqual(r.warnings.length, 0);
    });

    it('escalates risk for large blast radius', () => {
      const m = { category: 'repair' };
      const r = assessRisk(m, { files: 15, lines: 600 });
      assert.strictEqual(r.risk, 'medium');
      assert.ok(r.warnings.length > 0);
    });
  });
});
