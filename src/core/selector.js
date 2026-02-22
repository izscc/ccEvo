'use strict';

const { matchScore } = require('../gep/gene');
const { loadGenes } = require('../gep/store');

/**
 * Gene 选择器。
 *
 * 根据当前信号集匹配最优 Gene，驱动进化循环的变异选择。
 */

/**
 * 返回按匹配度排序的 Gene 列表。
 *
 * @param {string[]} signals - 当前信号集
 * @returns {{ gene: Object, score: number }[]} 按分数降序排列的 Gene 列表
 */
function rankGenes(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return [];

  const genes = loadGenes();
  if (!Array.isArray(genes) || genes.length === 0) return [];

  const ranked = genes
    .map((gene) => ({
      gene,
      score: matchScore(gene, signals),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked;
}

/**
 * 根据当前信号选择最佳 Gene。
 *
 * 选择逻辑：
 * 1. 从 store 加载所有 genes
 * 2. 用 gene.matchScore 计算每个 gene 的匹配分
 * 3. 过滤掉低于 minScore 的
 * 4. 如果有 preferCategory，给该类别的 gene 额外加 0.1 分
 * 5. 按分数降序排列，返回最高的
 *
 * @param {string[]} signals - 当前信号集
 * @param {Object} [options] - 选项
 * @param {string} [options.preferCategory] - 偏好类别（repair | optimize | innovate）
 * @param {number} [options.minScore] - 最低匹配分数（默认 0.3）
 * @returns {Object|null} 选中的 Gene 或 null
 */
function selectGene(signals, options = {}) {
  if (!Array.isArray(signals) || signals.length === 0) return null;

  const minScore = typeof options.minScore === 'number' ? options.minScore : 0.3;
  const { preferCategory } = options;

  const genes = loadGenes();
  if (!Array.isArray(genes) || genes.length === 0) return null;

  const scored = genes
    .map((gene) => {
      let score = matchScore(gene, signals);
      if (preferCategory && gene.category === preferCategory) {
        score += 0.1;
      }
      return { gene, score };
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  return scored[0].gene;
}

module.exports = { selectGene, rankGenes };
