'use strict';

/**
 * 能力节点 (Capability Node) 数据结构与操作。
 *
 * 能力节点是能力树的基本单元，描述一项具体能力。
 * 层级分为 low（基础操作）、mid（可复用流程）、high（决策范式）。
 */

const VALID_LEVELS = ['low', 'mid', 'high'];
const VALID_STATUSES = ['active', 'candidate', 'pruned'];

/**
 * 创建能力节点。
 *
 * @param {Object} params - 节点参数
 * @param {string} params.id - 如 "cap.communication.rich_messaging"
 * @param {string} params.name - 显示名
 * @param {'low'|'mid'|'high'} params.level - low=基础操作, mid=可复用流程, high=决策范式
 * @param {string} params.parent_id - 父节点 ID
 * @param {string} [params.input] - 输入描述
 * @param {string} [params.output] - 输出描述
 * @param {string[]} [params.preconditions] - 前置条件
 * @param {string} [params.failure_boundary] - 失败边界描述
 * @param {string[]} [params.linked_genes] - 关联 Gene ID 列表
 * @param {string[]} [params.linked_skills] - 关联 Skill 名称列表
 * @returns {Object} 能力节点对象
 */
function createNode(params) {
  if (!params.id) {
    throw new Error('Node id is required');
  }
  if (!params.name) {
    throw new Error('Node name is required');
  }
  if (!VALID_LEVELS.includes(params.level)) {
    throw new Error(`Invalid level: ${params.level}. Must be one of: ${VALID_LEVELS.join(', ')}`);
  }
  if (params.parent_id === undefined || params.parent_id === '') {
    throw new Error('Node parent_id is required');
  }

  return {
    id: params.id,
    name: params.name,
    level: params.level,
    parent_id: params.parent_id,
    input: params.input || '',
    output: params.output || '',
    preconditions: Array.isArray(params.preconditions) ? [...params.preconditions] : [],
    failure_boundary: params.failure_boundary || '',
    linked_genes: Array.isArray(params.linked_genes) ? [...params.linked_genes] : [],
    linked_skills: Array.isArray(params.linked_skills) ? [...params.linked_skills] : [],
    children: [],
    status: 'active',
    v_score: null,
    last_triggered: null,
    trigger_count: 0,
  };
}

/**
 * 验证节点结构完整性。
 *
 * @param {Object} node - 能力节点对象
 * @returns {{ valid: boolean, errors: string[] }} 验证结果
 */
function validateNode(node) {
  const errors = [];

  if (!node.id) {
    errors.push('id is required');
  }
  if (!node.name) {
    errors.push('name is required');
  }
  if (!VALID_LEVELS.includes(node.level)) {
    errors.push(`invalid level: ${node.level}`);
  }
  if (node.parent_id === undefined || node.parent_id === '') {
    errors.push('parent_id is required');
  }
  if (!VALID_STATUSES.includes(node.status)) {
    errors.push(`invalid status: ${node.status}`);
  }
  if (!Array.isArray(node.linked_genes)) {
    errors.push('linked_genes must be an array');
  }
  if (!Array.isArray(node.linked_skills)) {
    errors.push('linked_skills must be an array');
  }
  if (!Array.isArray(node.preconditions)) {
    errors.push('preconditions must be an array');
  }
  if (!Array.isArray(node.children)) {
    errors.push('children must be an array');
  }
  if (typeof node.trigger_count !== 'number' || node.trigger_count < 0) {
    errors.push('trigger_count must be a non-negative number');
  }
  if (node.v_score !== null && (typeof node.v_score !== 'number' || node.v_score < 0 || node.v_score > 100)) {
    errors.push('v_score must be null or a number between 0 and 100');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 更新节点统计（触发计数、最后触发时间）。
 *
 * @param {Object} node - 能力节点对象
 * @returns {Object} 更新后的节点（浅拷贝）
 */
function touchNode(node) {
  return {
    ...node,
    trigger_count: node.trigger_count + 1,
    last_triggered: new Date().toISOString(),
  };
}

module.exports = { createNode, validateNode, touchNode, VALID_LEVELS, VALID_STATUSES };
