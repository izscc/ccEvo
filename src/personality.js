'use strict';

/**
 * 轻量人格状态。
 *
 * 跟踪 Agent 的进化情绪和行为倾向，影响策略选择。
 */

const MOODS = ['curious', 'focused', 'cautious', 'restless', 'confident'];

/**
 * 创建人格状态。
 *
 * @param {Object} [overrides] - 覆盖默认值
 * @returns {Object} 人格状态
 */
function createPersonality(overrides = {}) {
  return {
    mood: overrides.mood || 'curious',
    confidence: overrides.confidence ?? 0.5,   // 0-1: 对自身能力的信心
    risk_appetite: overrides.risk_appetite ?? 0.5, // 0-1: 风险偏好
    focus_area: overrides.focus_area || null,   // 当前聚焦领域
    last_updated: new Date().toISOString(),
  };
}

/**
 * 根据进化结果更新人格状态。
 *
 * @param {Object} personality - 当前人格状态
 * @param {Object} feedback - 反馈信息
 * @param {boolean} feedback.success - 是否成功
 * @param {string} feedback.category - 变异类别
 * @param {number} [feedback.streak] - 连续成功/失败次数
 * @returns {Object} 更新后的人格状态
 */
function updatePersonality(personality, feedback) {
  const updated = { ...personality, last_updated: new Date().toISOString() };

  if (feedback.success) {
    updated.confidence = Math.min(1, updated.confidence + 0.05);
    if (feedback.category === 'innovate') {
      updated.mood = 'confident';
      updated.risk_appetite = Math.min(1, updated.risk_appetite + 0.03);
    } else {
      updated.mood = 'focused';
    }
  } else {
    updated.confidence = Math.max(0, updated.confidence - 0.08);
    updated.risk_appetite = Math.max(0, updated.risk_appetite - 0.05);
    updated.mood = 'cautious';
  }

  // 长期停滞 → 焦躁
  if (feedback.streak !== undefined) {
    if (feedback.streak >= 3 && !feedback.success) {
      updated.mood = 'restless';
      updated.risk_appetite = Math.min(1, updated.risk_appetite + 0.1);
    } else if (feedback.streak >= 5 && feedback.success) {
      updated.mood = 'curious';
      updated.risk_appetite = Math.min(1, updated.risk_appetite + 0.05);
    }
  }

  return updated;
}

/**
 * 根据人格状态建议策略偏好。
 *
 * @param {Object} personality - 人格状态
 * @returns {{ preferCategory: string|null, strategyHint: string|null }}
 */
function suggestFromPersonality(personality) {
  if (personality.mood === 'restless' && personality.risk_appetite > 0.6) {
    return { preferCategory: 'innovate', strategyHint: 'innovate' };
  }
  if (personality.mood === 'cautious' && personality.confidence < 0.3) {
    return { preferCategory: 'repair', strategyHint: 'harden' };
  }
  if (personality.mood === 'confident' && personality.risk_appetite > 0.7) {
    return { preferCategory: 'innovate', strategyHint: null };
  }
  return { preferCategory: null, strategyHint: null };
}

module.exports = {
  MOODS,
  createPersonality,
  updatePersonality,
  suggestFromPersonality,
};
