'use strict';

/**
 * 变异协议 (Mutation Protocol)。
 *
 * 定义三种变异类型：repair / optimize / innovate，
 * 每次变异必须声明完整上下文。
 */

/** @typedef {'repair' | 'optimize' | 'innovate'} MutationCategory */
/** @typedef {'low' | 'low-medium' | 'medium'} RiskLevel */

const RISK_MAP = {
  repair: 'low',
  optimize: 'low-medium',
  innovate: 'medium',
};

/**
 * 创建变异提案。
 *
 * @param {Object} params - 变异参数
 * @param {MutationCategory} params.category - 变异类别
 * @param {string[]} params.trigger_signals - 触发信号
 * @param {string} params.target - 变异目标描述
 * @param {string} params.expected_effect - 预期效果描述
 * @param {string} [params.gene_id] - 关联 Gene ID
 * @returns {Object} Mutation 提案
 */
function createMutation(params) {
  if (!params.category || !RISK_MAP[params.category]) {
    throw new Error(`Invalid mutation category: ${params.category}`);
  }
  if (!params.target) throw new Error('Mutation must have a target');
  if (!params.expected_effect) throw new Error('Mutation must have an expected_effect');

  return {
    type: 'Mutation',
    category: params.category,
    risk_level: RISK_MAP[params.category],
    trigger_signals: params.trigger_signals || [],
    target: params.target,
    expected_effect: params.expected_effect,
    gene_id: params.gene_id || null,
    created_at: new Date().toISOString(),
  };
}

/**
 * 根据策略分配判定变异类别是否允许。
 *
 * @param {MutationCategory} category - 变异类别
 * @param {Object} strategyWeights - 策略权重 { innovate, optimize, repair }
 * @param {Object[]} recentMutations - 近期变异历史
 * @returns {{ allowed: boolean, reason: string }}
 */
function checkStrategyAllowance(category, strategyWeights, recentMutations) {
  if (!strategyWeights[category] && strategyWeights[category] !== 0) {
    return { allowed: false, reason: `Unknown category: ${category}` };
  }

  if (strategyWeights[category] === 0) {
    return { allowed: false, reason: `Strategy forbids ${category} mutations` };
  }

  // 计算近期各类别占比
  if (recentMutations.length >= 10) {
    const counts = { repair: 0, optimize: 0, innovate: 0 };
    for (const m of recentMutations.slice(-10)) {
      counts[m.category] = (counts[m.category] || 0) + 1;
    }
    const currentRatio = counts[category] / 10;
    const targetRatio = strategyWeights[category] / 100;

    // 允许 20% 偏差容忍度
    if (currentRatio > targetRatio + 0.2) {
      return {
        allowed: false,
        reason: `${category} ratio (${(currentRatio * 100).toFixed(0)}%) exceeds target (${strategyWeights[category]}%) by >20%`,
      };
    }
  }

  return { allowed: true, reason: 'ok' };
}

/**
 * 评估变异风险。
 *
 * @param {Object} mutation - 变异提案
 * @param {Object} blast - 爆炸半径 { files: number, lines: number }
 * @returns {{ risk: RiskLevel, warnings: string[] }}
 */
function assessRisk(mutation, blast) {
  const warnings = [];
  let risk = RISK_MAP[mutation.category];

  if (blast.files > 10) {
    warnings.push(`High blast radius: ${blast.files} files`);
    risk = 'medium';
  }
  if (blast.lines > 500) {
    warnings.push(`Large change: ${blast.lines} lines`);
  }
  if (mutation.category === 'innovate' && blast.files > 5) {
    warnings.push('Innovation with wide blast radius');
    risk = 'medium';
  }

  return { risk, warnings };
}

module.exports = { createMutation, checkStrategyAllowance, assessRisk, RISK_MAP };
