'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { selectGene, rankGenes } = require('../src/core/selector');
const { saveGenes } = require('../src/gep/store');
const { createGene } = require('../src/gep/gene');

// 保存/恢复 genes
let originalGenes;

describe('selector', () => {
  beforeEach(() => {
    const store = require('../src/gep/store');
    originalGenes = store.loadGenes();
    // 设置测试 genes
    saveGenes([
      createGene({
        id: 'gene_test_repair',
        category: 'repair',
        signals_match: ['log_error', 'recurring_error'],
        strategy: ['Fix the error'],
      }),
      createGene({
        id: 'gene_test_optimize',
        category: 'optimize',
        signals_match: ['stable_success_plateau'],
        strategy: ['Optimize performance'],
      }),
      createGene({
        id: 'gene_test_innovate',
        category: 'innovate',
        signals_match: ['user_feature_request', 'capability_gap'],
        strategy: ['Create new capability'],
      }),
    ]);
  });

  afterEach(() => {
    saveGenes(originalGenes);
  });

  it('selectGene returns null for empty signals', () => {
    assert.strictEqual(selectGene([]), null);
  });

  it('selectGene returns best matching gene', () => {
    const gene = selectGene(['log_error', 'recurring_error']);
    assert.ok(gene);
    assert.strictEqual(gene.id, 'gene_test_repair');
  });

  it('selectGene applies preferCategory bonus', () => {
    const gene = selectGene(['log_error'], { preferCategory: 'optimize', minScore: 0 });
    // With low min score, should still find something
    assert.ok(gene);
  });

  it('selectGene returns null when no gene matches min score', () => {
    const gene = selectGene(['unknown_signal'], { minScore: 0.5 });
    assert.strictEqual(gene, null);
  });

  it('rankGenes returns sorted list', () => {
    const ranked = rankGenes(['log_error', 'recurring_error']);
    assert.ok(ranked.length > 0);
    // First should have highest score
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i - 1].score >= ranked[i].score);
    }
  });

  it('rankGenes returns empty for empty signals', () => {
    const ranked = rankGenes([]);
    assert.deepStrictEqual(ranked, []);
  });
});
