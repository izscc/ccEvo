'use strict';

/**
 * 价值函数突变器 (VFM Mutator)。
 *
 * 根据近期进化成果微调 V-Score 权重，使价值函数自身也能随环境演化。
 * 每次突变幅度受限，确保权重缓慢漂移而非剧烈变化。
 */

/** @constant {Object} 默认权重 */
const DEFAULT_WEIGHTS = {
  frequency: 3,
  failReduce: 3,
  userBurden: 2,
  selfCost: 2,
};

/** @constant {number} 单次最大调整幅度 */
const MAX_ADJUSTMENT = 0.5;

/** @constant {number} 权重下限 */
const WEIGHT_MIN = 1;

/** @constant {number} 权重上限 */
const WEIGHT_MAX = 5;

/** @constant {number} 高成功率阈值 */
const HIGH_SUCCESS_THRESHOLD = 0.8;

/** @constant {number} 高失败率阈值 */
const HIGH_FAIL_THRESHOLD = 0.4;

/**
 * 将权重限制在 [WEIGHT_MIN, WEIGHT_MAX] 范围内。
 *
 * @param {number} weight - 原始权重
 * @returns {number} 限制后的权重
 */
function clampWeight(weight) {
  return Math.min(Math.max(weight, WEIGHT_MIN), WEIGHT_MAX);
}

/**
 * 计算 capsule 列表的成功率。
 *
 * @param {Object[]} capsules - Capsule 列表
 * @returns {number} 0 到 1 的成功率
 */
function computeSuccessRate(capsules) {
  if (!capsules || capsules.length === 0) return 1.0;
  const passed = capsules.filter(c => c.metrics && c.metrics.validation_passed).length;
  return passed / capsules.length;
}

/**
 * 判断近期是否缺乏创新。
 *
 * 如果 innovate 类别的 capsule 占比低于 10% 且有足够样本，视为创新不足。
 *
 * @param {Object[]} capsules - 近期 Capsule 列表
 * @returns {boolean} 是否创新不足
 */
function isLowInnovation(capsules) {
  if (capsules.length < 5) return false;
  const innovateCount = capsules.filter(c => c.mutation_category === 'innovate').length;
  return (innovateCount / capsules.length) < 0.1;
}

/**
 * 判断近期是否有新能力生长事件。
 *
 * @param {Object[]} events - 近期事件列表
 * @returns {boolean} 是否有能力生长
 */
function hasCapabilityGrowth(events) {
  if (!events || events.length === 0) return false;
  return events.some(e => e.event_type === 'capability_grown');
}

/**
 * 根据进化成果微调 VFM 权重。
 *
 * 突变规则：
 * - 每次突变 <= +/-0.5 权重调整
 * - 如果近期成功率高 (>80%) 但创新少 -> 降低 failReduce 权重，提升 frequency
 * - 如果近期失败率高 (>40%) -> 提升 failReduce 权重
 * - 始终保证每个权重在 [1, 5] 范围内
 *
 * @param {Object} currentWeights - 当前权重
 * @param {number} currentWeights.frequency - 频率权重
 * @param {number} currentWeights.failReduce - 失败降低权重
 * @param {number} currentWeights.userBurden - 用户负担权重
 * @param {number} currentWeights.selfCost - 自身成本权重
 * @param {Object[]} recentCapsules - 近期 Capsule
 * @param {Object[]} recentEvents - 近期事件
 * @returns {Object} 调整后的权重
 */
function mutateWeights(currentWeights, recentCapsules, recentEvents) {
  const weights = {
    frequency: currentWeights.frequency,
    failReduce: currentWeights.failReduce,
    userBurden: currentWeights.userBurden,
    selfCost: currentWeights.selfCost,
  };

  const capsules = recentCapsules || [];
  const events = recentEvents || [];
  const successRate = computeSuccessRate(capsules);
  const failRate = 1 - successRate;

  // 规则 1: 高成功率但创新少 -> 降低 failReduce，提升 frequency
  if (successRate > HIGH_SUCCESS_THRESHOLD && isLowInnovation(capsules)) {
    weights.failReduce -= MAX_ADJUSTMENT;
    weights.frequency += MAX_ADJUSTMENT;
  }

  // 规则 2: 高失败率 -> 提升 failReduce
  if (failRate > HIGH_FAIL_THRESHOLD) {
    weights.failReduce += MAX_ADJUSTMENT;
  }

  // 规则 3: 如果有能力生长，轻微提升 userBurden（鼓励自动化新能力）
  if (hasCapabilityGrowth(events)) {
    weights.userBurden += MAX_ADJUSTMENT * 0.5;
  }

  // 规则 4: 如果成功率很高且无能力生长，轻微提升 selfCost（鼓励简化）
  if (successRate > HIGH_SUCCESS_THRESHOLD && !hasCapabilityGrowth(events)) {
    weights.selfCost += MAX_ADJUSTMENT * 0.5;
  }

  // 限制所有权重在 [1, 5] 范围内
  weights.frequency = clampWeight(weights.frequency);
  weights.failReduce = clampWeight(weights.failReduce);
  weights.userBurden = clampWeight(weights.userBurden);
  weights.selfCost = clampWeight(weights.selfCost);

  return weights;
}

module.exports = {
  mutateWeights,
  computeSuccessRate,
  isLowInnovation,
  hasCapabilityGrowth,
  clampWeight,
  DEFAULT_WEIGHTS,
  MAX_ADJUSTMENT,
  WEIGHT_MIN,
  WEIGHT_MAX,
  HIGH_SUCCESS_THRESHOLD,
  HIGH_FAIL_THRESHOLD,
};
