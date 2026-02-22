'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkADL, hasStabilityRegression } = require('../src/adl/lock');
const { isProtected } = require('../src/adl/rollback');
const { detectDegradation } = require('../src/adl/validator');

describe('adl lock', () => {
  it('passes for valid mutation', () => {
    const mutation = {
      category: 'repair',
      expected_effect: 'Fix crash when session expires unexpectedly',
      gene_id: 'gene_test',
    };
    const blast = { files: 3, lines: 50 };
    const result = checkADL(mutation, blast, []);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.violations.length, 0);
  });

  it('flags complexity_increase_without_justification', () => {
    const mutation = {
      category: 'innovate',
      expected_effect: 'Create new capability for auto-deploy',
      gene_id: 'gene_test',
    };
    const blast = { files: 25, lines: 1000 };
    const result = checkADL(mutation, blast, []);
    assert.ok(result.violations.includes('complexity_increase_without_justification'));
  });

  it('flags unverifiable_evolution for short effect', () => {
    const mutation = {
      category: 'repair',
      expected_effect: 'Fix it',
      gene_id: 'gene_test',
    };
    const result = checkADL(mutation, { files: 1, lines: 5 }, []);
    assert.ok(result.violations.includes('unverifiable_evolution'));
  });

  it('flags vague_concept_detected', () => {
    const mutation = {
      category: 'repair',
      expected_effect: '从更高维度来看这个问题需要被修复',
      gene_id: 'gene_test',
    };
    const result = checkADL(mutation, { files: 1, lines: 5 }, []);
    assert.ok(result.violations.includes('vague_concept_detected'));
  });

  it('flags no_rollback_path when no gene_id', () => {
    const mutation = {
      category: 'repair',
      expected_effect: 'Fix crash when session expires unexpectedly',
    };
    const result = checkADL(mutation, { files: 1, lines: 5 }, []);
    assert.ok(result.violations.includes('no_rollback_path'));
  });

  it('hasStabilityRegression returns false for short history', () => {
    assert.strictEqual(hasStabilityRegression([]), false);
    assert.strictEqual(hasStabilityRegression(Array(5).fill({ success: true })), false);
  });

  it('hasStabilityRegression detects regression', () => {
    const history = [
      ...Array(5).fill({ success: true }),   // previous: 100%
      ...Array(5).fill({ success: false }),   // recent: 0%
    ];
    assert.strictEqual(hasStabilityRegression(history), true);
  });
});

describe('adl rollback', () => {
  it('isProtected detects protected paths', () => {
    assert.strictEqual(isProtected('package.json'), true);
    assert.strictEqual(isProtected('SKILL.md'), true);
    assert.strictEqual(isProtected('assets/genes.json'), true);
    assert.strictEqual(isProtected('.git/config'), true);
    assert.strictEqual(isProtected('node_modules/foo'), true);
  });

  it('isProtected allows normal files', () => {
    assert.strictEqual(isProtected('src/core/engine.js'), false);
    assert.strictEqual(isProtected('test/foo.test.js'), false);
  });
});

describe('adl validator', () => {
  it('detects no degradation for healthy state', () => {
    const result = detectDegradation(
      [{ success: true }, { success: true }],
      [{ event_type: 'solidify_success' }],
    );
    assert.strictEqual(result.degraded, false);
    assert.strictEqual(result.indicators.length, 0);
  });

  it('detects high_failure_rate', () => {
    const capsules = Array(5).fill({ success: false });
    const result = detectDegradation(capsules, []);
    assert.ok(result.degraded);
    assert.ok(result.indicators.includes('high_failure_rate'));
  });

  it('detects repeated_rollbacks', () => {
    const events = [
      { event_type: 'rollback', type: 'rollback' },
      { event_type: 'rollback', type: 'rollback' },
      { event_type: 'rollback', type: 'rollback' },
    ];
    const result = detectDegradation([], events);
    assert.ok(result.degraded);
    assert.ok(result.indicators.includes('repeated_rollbacks'));
  });

  it('provides recommendation when degraded', () => {
    const capsules = Array(5).fill({ success: false });
    const result = detectDegradation(capsules, []);
    assert.ok(result.recommendation.length > 0);
  });
});
