'use strict';

/**
 * ADL 劣化检测器。
 *
 * 通过分析 Capsule 历史和 Event 历史，
 * 检测近期进化是否出现劣化趋势，并给出策略建议。
 */

/**
 * 检测近期进化是否出现劣化。
 *
 * 劣化指标：
 * 1. 最近 5 个 capsule 失败率 > 40% -> high_failure_rate
 * 2. 连续 3 次 rollback event -> repeated_rollbacks
 * 3. 最近无 solidify_success 但有多个 solidify_failed -> solidify_blocked
 *
 * @param {Object[]} capsules - Capsule 历史，每项应有 success 布尔字段
 * @param {Object[]} events - Event 历史，每项应有 type 字段
 * @returns {{ degraded: boolean, indicators: string[], recommendation: string }}
 */
function detectDegradation(capsules, events) {
  const indicators = [];

  // 1. 最近 5 个 capsule 失败率 > 40%
  if (Array.isArray(capsules) && capsules.length > 0) {
    const recent = capsules.slice(-5);
    const failedCount = recent.filter((c) => c.success === false).length;
    const failRate = failedCount / recent.length;

    if (failRate > 0.4) {
      indicators.push('high_failure_rate');
    }
  }

  // 2. 连续 3 次 rollback event
  if (Array.isArray(events) && events.length >= 3) {
    const lastThree = events.slice(-3);
    const allRollbacks = lastThree.every((e) => e.event_type === 'rollback' || e.type === 'rollback');

    if (allRollbacks) {
      indicators.push('repeated_rollbacks');
    }
  }

  // 3. 最近无 solidify_success 但有多个 solidify_failed
  if (Array.isArray(events) && events.length > 0) {
    const recentEvents = events.slice(-10);
    const hasSolidifySuccess = recentEvents.some(
      (e) => e.event_type === 'solidify_success' || e.type === 'solidify_success'
    );
    const solidifyFailedCount = recentEvents.filter(
      (e) => e.event_type === 'solidify_failed' || e.type === 'solidify_failed'
    ).length;

    if (!hasSolidifySuccess && solidifyFailedCount >= 2) {
      indicators.push('solidify_blocked');
    }
  }

  const degraded = indicators.length > 0;

  let recommendation = '';
  if (degraded) {
    if (
      indicators.includes('high_failure_rate') ||
      indicators.includes('repeated_rollbacks')
    ) {
      recommendation =
        "建议切换到 'repair-only' 策略，优先修复已知问题，暂停创新变异。";
    } else {
      recommendation =
        "建议切换到 'harden' 策略，聚焦稳固现有能力，减少创新权重。";
    }
  }

  return { degraded, indicators, recommendation };
}

module.exports = { detectDegradation };
