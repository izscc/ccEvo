'use strict';

/**
 * 修剪策略 (Pruner)。
 *
 * 分析能力树节点，识别需要修剪或合并的候选节点。
 * 使用时间阈值和 V-Score 判断节点活跃度，使用 Jaccard 相似度检测可合并节点。
 */

/** @constant {number} 候选修剪阈值天数 */
const CANDIDATE_PRUNE_DAYS = 30;

/** @constant {number} 自动修剪阈值天数 */
const AUTO_PRUNE_DAYS = 60;

/** @constant {number} V-Score 修剪阈值 */
const PRUNE_VSCORE_THRESHOLD = 40;

/** @constant {number} 名称合并相似度阈值 */
const MERGE_SIMILARITY_THRESHOLD = 0.8;

/**
 * 将名称拆分为 token 集合。
 *
 * 按空格和点号分词，转为小写。
 *
 * @param {string} name - 节点名称
 * @returns {Set<string>} token 集合
 */
function tokenize(name) {
  if (!name) return new Set();
  const tokens = name.toLowerCase().split(/[\s.]+/).filter(Boolean);
  return new Set(tokens);
}

/**
 * 计算两个集合的 Jaccard 相似度。
 *
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @param {Set<string>} setA - 集合 A
 * @param {Set<string>} setB - 集合 B
 * @returns {number} 0 到 1 的相似度分数
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 计算节点距今未触发天数。
 *
 * @param {Object} node - 能力节点
 * @returns {number} 距今天数，如果未曾触发返回 Infinity
 */
function daysSinceTriggered(node) {
  if (!node.last_triggered) return Infinity;
  const lastMs = new Date(node.last_triggered).getTime();
  const nowMs = Date.now();
  return (nowMs - lastMs) / (24 * 60 * 60 * 1000);
}

/**
 * 分析哪些节点应该被修剪或合并。
 *
 * 规则：
 * - 30天未触发 + v_score < 40 -> candidate_prune
 * - 60天未触发 -> auto_prune
 * - 名称 Jaccard 相似度 > 0.8 -> merge_suggestions
 *
 * @param {Object[]} nodes - 所有节点
 * @returns {{ candidate_prune: Object[], auto_prune: Object[], merge_suggestions: Array<[string,string]> }}
 */
function analyzePruning(nodes) {
  const candidatePrune = [];
  const autoPrune = [];
  const mergeSuggestions = [];

  // 只分析 active 和 candidate 状态的节点
  const activeNodes = nodes.filter(n => n.status !== 'pruned');

  for (const node of activeNodes) {
    const days = daysSinceTriggered(node);
    const vScore = node.v_score;

    // 60天未触发 -> auto_prune（无论 v_score）
    if (days > AUTO_PRUNE_DAYS) {
      autoPrune.push(node);
    }
    // 30天未触发 + v_score < 40 -> candidate_prune
    else if (days > CANDIDATE_PRUNE_DAYS && (vScore === null || vScore < PRUNE_VSCORE_THRESHOLD)) {
      candidatePrune.push(node);
    }
  }

  // 检测名称相似度，提出合并建议
  for (let i = 0; i < activeNodes.length; i++) {
    const tokensA = tokenize(activeNodes[i].name);
    for (let j = i + 1; j < activeNodes.length; j++) {
      const tokensB = tokenize(activeNodes[j].name);
      const similarity = jaccardSimilarity(tokensA, tokensB);
      if (similarity > MERGE_SIMILARITY_THRESHOLD) {
        mergeSuggestions.push([activeNodes[i].id, activeNodes[j].id]);
      }
    }
  }

  return {
    candidate_prune: candidatePrune,
    auto_prune: autoPrune,
    merge_suggestions: mergeSuggestions,
  };
}

module.exports = {
  analyzePruning,
  tokenize,
  jaccardSimilarity,
  daysSinceTriggered,
  CANDIDATE_PRUNE_DAYS,
  AUTO_PRUNE_DAYS,
  PRUNE_VSCORE_THRESHOLD,
  MERGE_SIMILARITY_THRESHOLD,
};
