'use strict';

const crypto = require('node:crypto');

/**
 * PCEC 周期管理。
 *
 * 管理单个 PCEC 周期的生命周期，跟踪产出，
 * 检测停滞并提供强制突破机制。
 */

const PCEC_INTERVAL_MS = parseInt(process.env.PCEC_INTERVAL_MS || '10800000', 10); // 3h

/** 判定非实质产出的排除关键词 */
const EXCLUDE_KEYWORDS = ['总结', '回顾', '复述', '没有明显', '格式', '措辞'];

/** 有效产出类型 */
const SUBSTANTIVE_TYPES = ['capability', 'abstraction', 'leverage'];

/**
 * PCEC 周期实例。
 *
 * 跟踪单个周期的产出，判定是否有实质性内容，
 * 并在周期结束时更新全局停滞计数器。
 */
class PCECCycle {
  constructor() {
    this.id = `pcec_${crypto.randomUUID().slice(0, 8)}`;
    this.started_at = new Date().toISOString();
    this.ended_at = null;
    this.outcomes = [];
    this.status = 'running'; // running | completed | stagnant
  }

  /**
   * 记录周期产出。
   *
   * @param {Object} outcome - 产出项
   * @param {'capability'|'abstraction'|'leverage'} outcome.type - 产出类型
   * @param {string} outcome.description - 产出描述
   */
  addOutcome(outcome) {
    if (!outcome || typeof outcome !== 'object') return;
    this.outcomes.push({
      type: outcome.type || 'unknown',
      description: outcome.description || '',
      added_at: new Date().toISOString(),
    });
  }

  /**
   * 结束周期。
   *
   * 判定是否有实质产出，更新状态和全局停滞计数。
   *
   * @returns {{ substantive: boolean, stagnant_count: number }}
   */
  complete() {
    this.ended_at = new Date().toISOString();

    const substantive = this.hasSubstantiveOutcome();

    if (substantive) {
      this.status = 'completed';
      resetStagnantCount();
    } else {
      this.status = 'stagnant';
      stagnantCount += 1;
    }

    return { substantive, stagnant_count: stagnantCount };
  }

  /**
   * 检查周期产出是否有实质性内容。
   *
   * 不计为实质产出的情况：
   * - outcomes 为空
   * - 所有 outcome 的 type 都不在有效类型列表中
   * - description 匹配排除关键词的 outcome 不计入
   * - 至少一条有效产出才返回 true
   *
   * @returns {boolean} 是否有实质性产出
   */
  hasSubstantiveOutcome() {
    if (!this.outcomes || this.outcomes.length === 0) {
      return false;
    }

    // 筛选有效类型的产出
    const validTypeOutcomes = this.outcomes.filter((o) =>
      SUBSTANTIVE_TYPES.includes(o.type)
    );

    if (validTypeOutcomes.length === 0) {
      return false;
    }

    // 进一步排除描述中包含排除关键词的产出
    const substantiveOutcomes = validTypeOutcomes.filter((o) => {
      if (!o.description || typeof o.description !== 'string') return false;
      const desc = o.description;
      return !EXCLUDE_KEYWORDS.some((keyword) => desc.includes(keyword));
    });

    return substantiveOutcomes.length > 0;
  }
}

/** 全局停滞计数器 */
let stagnantCount = 0;

/**
 * 检查是否需要强制突破。
 *
 * 连续两个周期无实质产出时返回 true。
 *
 * @returns {boolean} 是否需要强制突破
 */
function needsForceBreakthrough() {
  return stagnantCount >= 2;
}

/**
 * 重置停滞计数器。
 */
function resetStagnantCount() {
  stagnantCount = 0;
}

/**
 * 获取当前停滞计数。
 *
 * @returns {number} 当前连续停滞周期数
 */
function getStagnantCount() {
  return stagnantCount;
}

module.exports = {
  PCEC_INTERVAL_MS,
  PCECCycle,
  needsForceBreakthrough,
  resetStagnantCount,
  getStagnantCount,
};
