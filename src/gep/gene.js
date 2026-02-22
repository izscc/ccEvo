'use strict';

const crypto = require('node:crypto');

/**
 * Gene 数据结构与 CRUD 操作。
 *
 * Gene 是进化的基本单元，描述一种可执行的变异策略。
 */

/** @typedef {'repair' | 'optimize' | 'innovate'} GeneCategory */

/**
 * 创建新 Gene。
 *
 * @param {Object} params - Gene 参数
 * @param {string} params.id - 唯一标识（可选，自动生成）
 * @param {GeneCategory} params.category - 变异类别
 * @param {string[]} params.signals_match - 触发信号列表
 * @param {string[]} params.preconditions - 前置条件描述
 * @param {string[]} params.strategy - 执行策略步骤
 * @param {Object} [params.constraints] - 约束条件
 * @param {number} [params.constraints.max_files] - 最大文件变更数
 * @param {string[]} [params.constraints.forbidden_paths] - 禁止路径
 * @param {string[]} [params.validation] - 验证命令列表
 * @param {string|null} [params.capability_node_id] - 关联能力树节点 ID
 * @param {number|null} [params.v_score] - VFM 评分
 * @returns {Object} Gene 对象
 */
function createGene(params) {
  if (!params.category || !['repair', 'optimize', 'innovate'].includes(params.category)) {
    throw new Error(`Invalid gene category: ${params.category}`);
  }
  if (!Array.isArray(params.signals_match) || params.signals_match.length === 0) {
    throw new Error('Gene must have at least one signal_match');
  }
  if (!Array.isArray(params.strategy) || params.strategy.length === 0) {
    throw new Error('Gene must have at least one strategy step');
  }

  return {
    type: 'Gene',
    id: params.id || `gene_${crypto.randomUUID().slice(0, 8)}`,
    category: params.category,
    signals_match: params.signals_match,
    preconditions: params.preconditions || [],
    strategy: params.strategy,
    constraints: {
      max_files: params.constraints?.max_files ?? 12,
      forbidden_paths: params.constraints?.forbidden_paths ?? ['.git', 'node_modules'],
    },
    validation: params.validation || [],
    capability_node_id: params.capability_node_id || null,
    v_score: params.v_score ?? null,
    created_at: new Date().toISOString(),
  };
}

/**
 * 更新 Gene 字段。
 *
 * @param {Object} gene - 现有 Gene
 * @param {Object} updates - 要更新的字段
 * @returns {Object} 更新后的 Gene
 */
function updateGene(gene, updates) {
  const allowed = [
    'category', 'signals_match', 'preconditions', 'strategy',
    'constraints', 'validation', 'capability_node_id', 'v_score',
  ];
  const result = { ...gene };
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      result[key] = updates[key];
    }
  }
  return result;
}

/**
 * 检查 Gene 的信号是否匹配给定信号集。
 *
 * @param {Object} gene - Gene 对象
 * @param {string[]} signals - 当前信号集
 * @returns {number} 匹配度分数（匹配信号数 / 总需求信号数）
 */
function matchScore(gene, signals) {
  if (!gene.signals_match || gene.signals_match.length === 0) return 0;
  const signalSet = new Set(signals);
  let matched = 0;
  for (const s of gene.signals_match) {
    if (signalSet.has(s)) {
      matched++;
    } else {
      // 支持前缀匹配，如 errsig:* 匹配 errsig:timeout
      const prefix = s.replace(/:.*$/, ':');
      if (prefix !== s && signals.some(sig => sig.startsWith(prefix))) {
        matched += 0.5;
      }
    }
  }
  return matched / gene.signals_match.length;
}

/**
 * 验证 Gene 结构完整性。
 *
 * @param {Object} gene - Gene 对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateGene(gene) {
  const errors = [];
  if (gene.type !== 'Gene') errors.push('type must be "Gene"');
  if (!gene.id) errors.push('id is required');
  if (!['repair', 'optimize', 'innovate'].includes(gene.category)) {
    errors.push(`invalid category: ${gene.category}`);
  }
  if (!Array.isArray(gene.signals_match) || gene.signals_match.length === 0) {
    errors.push('signals_match must be non-empty array');
  }
  if (!Array.isArray(gene.strategy) || gene.strategy.length === 0) {
    errors.push('strategy must be non-empty array');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { createGene, updateGene, matchScore, validateGene };
