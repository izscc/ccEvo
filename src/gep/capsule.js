'use strict';

const crypto = require('node:crypto');

/**
 * Capsule（成功经验胶囊）数据结构。
 *
 * Capsule 记录一次成功的进化变异结果，作为可复用的经验沉淀。
 */

/**
 * 创建新 Capsule。
 *
 * @param {Object} params - Capsule 参数
 * @param {string} params.gene_id - 触发此 Capsule 的 Gene ID
 * @param {string} params.mutation_category - 变异类别
 * @param {string[]} params.signals - 触发信号
 * @param {string[]} params.files_changed - 变更的文件列表
 * @param {string} params.summary - 变更摘要
 * @param {Object} [params.metrics] - 度量指标
 * @param {number} [params.metrics.blast_files] - 变更文件数
 * @param {number} [params.metrics.blast_lines] - 变更行数
 * @param {boolean} [params.metrics.validation_passed] - 验证是否通过
 * @returns {Object} Capsule 对象
 */
function createCapsule(params) {
  if (!params.gene_id) throw new Error('Capsule must reference a gene_id');
  if (!params.summary) throw new Error('Capsule must have a summary');

  return {
    type: 'Capsule',
    id: `capsule_${crypto.randomUUID().slice(0, 8)}`,
    gene_id: params.gene_id,
    mutation_category: params.mutation_category || 'repair',
    signals: params.signals || [],
    files_changed: params.files_changed || [],
    summary: params.summary,
    metrics: {
      blast_files: params.metrics?.blast_files ?? 0,
      blast_lines: params.metrics?.blast_lines ?? 0,
      validation_passed: params.metrics?.validation_passed ?? true,
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * 从 Capsule 历史中检测稳定性趋势。
 *
 * @param {Object[]} capsules - Capsule 列表（按时间排序）
 * @param {number} [windowSize=5] - 窗口大小
 * @returns {{ trend: 'improving' | 'stable' | 'degrading', success_rate: number }}
 */
function analyzeTrend(capsules, windowSize = 5) {
  if (capsules.length === 0) {
    return { trend: 'stable', success_rate: 1.0 };
  }

  const recent = capsules.slice(-windowSize);
  const successCount = recent.filter(c => c.metrics.validation_passed).length;
  const successRate = successCount / recent.length;

  if (capsules.length < windowSize * 2) {
    return { trend: 'stable', success_rate: successRate };
  }

  const older = capsules.slice(-(windowSize * 2), -windowSize);
  const olderSuccessRate = older.filter(c => c.metrics.validation_passed).length / older.length;

  let trend = 'stable';
  if (successRate > olderSuccessRate + 0.1) trend = 'improving';
  else if (successRate < olderSuccessRate - 0.1) trend = 'degrading';

  return { trend, success_rate: successRate };
}

module.exports = { createCapsule, analyzeTrend };
