'use strict';

/**
 * ADL 反进化锁。
 *
 * 强制优先级：稳定性 > 可解释性 > 可复用性 > 扩展性 > 新颖性。
 * 每次进化提交前必须通过全部门控检查。
 */

/** 模糊语言黑名单 */
const VAGUE_TERMS = [
  '某种程度上',
  '可能是一种',
  '从更高维度',
  '本质上是',
  'essentially',
  'in some way',
  'to some extent',
];

/**
 * 检查最近的 capsule 历史是否出现稳定性回归。
 *
 * 比较最近 5 个 capsule 的成功率与前 5 个的成功率，
 * 如果最近成功率 < 前期成功率 * 0.9，视为回归。
 *
 * @param {Object[]} capsuleHistory - 历史 Capsule 列表，每项应有 success 布尔字段
 * @returns {boolean} 是否存在稳定性回归
 */
function hasStabilityRegression(capsuleHistory) {
  if (!Array.isArray(capsuleHistory) || capsuleHistory.length < 10) {
    return false;
  }

  const recent = capsuleHistory.slice(-5);
  const previous = capsuleHistory.slice(-10, -5);

  const successRate = (items) => {
    if (items.length === 0) return 1;
    const successes = items.filter((c) => c.success === true).length;
    return successes / items.length;
  };

  const recentRate = successRate(recent);
  const previousRate = successRate(previous);

  return recentRate < previousRate * 0.9;
}

/**
 * ADL 门控检查。每次进化提交前必须通过。
 *
 * 执行 5 项检查：
 * 1. 复杂度检查 - innovate 类变异且爆炸半径过大
 * 2. 可验证性 - expected_effect 为空或过短
 * 3. 反玄学 - 检测模糊语言
 * 4. 稳定性回归 - 最近成功率下降
 * 5. 回滚能力 - 必须有 gene_id 以支持追溯
 *
 * @param {Object} mutation - 变异提案 { category, target, expected_effect, gene_id }
 * @param {Object} blast - 爆炸半径 { files: number, lines: number }
 * @param {Object[]} capsuleHistory - 历史 Capsule
 * @returns {{ ok: boolean, violations: string[] }}
 */
function checkADL(mutation, blast, capsuleHistory) {
  const violations = [];

  // 1. 复杂度检查：innovate 类变异且 blast.files > 20
  if (mutation.category === 'innovate' && blast && blast.files > 20) {
    violations.push('complexity_increase_without_justification');
  }

  // 2. 可验证性：expected_effect 为空或长度 < 10
  if (
    !mutation.expected_effect ||
    typeof mutation.expected_effect !== 'string' ||
    mutation.expected_effect.trim().length < 10
  ) {
    violations.push('unverifiable_evolution');
  }

  // 3. 反玄学：检测模糊语言
  if (mutation.expected_effect && typeof mutation.expected_effect === 'string') {
    const lower = mutation.expected_effect.toLowerCase();
    for (const term of VAGUE_TERMS) {
      if (lower.includes(term.toLowerCase())) {
        violations.push('vague_concept_detected');
        break;
      }
    }
  }

  // 4. 稳定性回归：最近 capsule 成功率显著下降
  if (hasStabilityRegression(capsuleHistory)) {
    violations.push('stability_regression');
  }

  // 5. 回滚能力：mutation 没有 gene_id（无法追溯）
  if (!mutation.gene_id) {
    violations.push('no_rollback_path');
  }

  return { ok: violations.length === 0, violations };
}

module.exports = { checkADL, hasStabilityRegression, VAGUE_TERMS };
