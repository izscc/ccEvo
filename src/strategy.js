'use strict';

/**
 * 进化策略预设。
 *
 * 定义不同场景下 innovate / optimize / repair 的权重分配，
 * 并提供基于进化历史的自动策略检测。
 */

/**
 * @typedef {Object} StrategyConfig
 * @property {number} innovate - 创新权重百分比
 * @property {number} optimize - 优化权重百分比
 * @property {number} repair - 修复权重百分比
 * @property {string} description - 策略描述
 */

/** @type {Record<string, StrategyConfig>} */
const STRATEGIES = {
  balanced: { innovate: 50, optimize: 30, repair: 20, description: '日常运行' },
  innovate: { innovate: 80, optimize: 15, repair: 5, description: '系统稳定，快速创新' },
  harden: { innovate: 20, optimize: 40, repair: 40, description: '大改后聚焦稳固' },
  'repair-only': { innovate: 0, optimize: 20, repair: 80, description: '紧急修复' },
  'early-stabilize': {
    innovate: 10,
    optimize: 30,
    repair: 60,
    description: '早期稳定化（前5周期自动）',
  },
  'steady-state': { innovate: 40, optimize: 40, repair: 20, description: '稳态运行' },
};

/**
 * 获取策略配置。
 *
 * @param {string} name - 策略名称
 * @returns {StrategyConfig} 策略配置
 * @throws {Error} 如果策略名称不存在
 */
function getStrategy(name) {
  const strategy = STRATEGIES[name];
  if (!strategy) {
    const valid = Object.keys(STRATEGIES).join(', ');
    throw new Error(`Unknown strategy "${name}". Valid strategies: ${valid}`);
  }
  return { ...strategy };
}

/**
 * 根据进化历史自动检测最佳策略。
 *
 * 检测逻辑：
 * 1. 总周期数 < 5 -> 'early-stabilize'
 * 2. 最近连续 5 个周期无实质产出 -> 'innovate'
 * 3. 最近 solidify_failed 比例 > 40% -> 'repair-only'
 * 4. 最近 solidify_failed 比例 > 20% -> 'harden'
 * 5. 否则 -> 'balanced'
 *
 * @param {Object[]} events - 进化事件历史
 * @returns {string} 策略名
 */
function autoDetectStrategy(events) {
  if (!Array.isArray(events)) return 'balanced';

  // 统计周期数（type 为 cycle_complete 或有 cycle 标记的事件）
  const cycleEvents = events.filter(
    (e) => e.type === 'cycle_complete' || e.cycle !== undefined
  );
  const totalCycles = cycleEvents.length || events.length;

  if (totalCycles < 5) {
    return 'early-stabilize';
  }

  // 检查最近 5 个周期是否无实质产出
  const recentEvents = events.slice(-5);
  const hasNoOutput = recentEvents.every(
    (e) =>
      !e.mutation_applied ||
      e.result === 'no_change' ||
      e.result === 'skipped'
  );
  if (hasNoOutput) {
    return 'innovate';
  }

  // 检查最近事件中 solidify_failed 比例
  const recentWindow = events.slice(-10);
  const solidifyAttempts = recentWindow.filter(
    (e) => e.solidify_failed !== undefined || e.solidify_success !== undefined
  );
  if (solidifyAttempts.length > 0) {
    const failedCount = solidifyAttempts.filter((e) => e.solidify_failed).length;
    const failRatio = failedCount / solidifyAttempts.length;

    if (failRatio > 0.4) {
      return 'repair-only';
    }
    if (failRatio > 0.2) {
      return 'harden';
    }
  }

  return 'balanced';
}

module.exports = { STRATEGIES, getStrategy, autoDetectStrategy };
