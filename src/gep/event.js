'use strict';

const crypto = require('node:crypto');

/**
 * EvolutionEvent 日志数据结构。
 *
 * 记录每次进化行为的完整上下文，用于审计和回溯。
 */

/** @typedef {'signal_extracted' | 'gene_selected' | 'mutation_applied' | 'solidify_success' | 'solidify_failed' | 'rollback' | 'pcec_cycle' | 'capability_grown' | 'capability_pruned' | 'adl_violation'} EventType */

/**
 * 创建 EvolutionEvent。
 *
 * @param {Object} params - 事件参数
 * @param {EventType} params.event_type - 事件类型
 * @param {Object} params.payload - 事件载荷
 * @param {string} [params.gene_id] - 关联 Gene ID
 * @param {string} [params.cycle_id] - 关联 PCEC 周期 ID
 * @returns {Object} EvolutionEvent 对象
 */
function createEvent(params) {
  if (!params.event_type) throw new Error('Event must have an event_type');

  return {
    type: 'EvolutionEvent',
    id: `evt_${crypto.randomUUID().slice(0, 8)}`,
    event_type: params.event_type,
    payload: params.payload || {},
    gene_id: params.gene_id || null,
    cycle_id: params.cycle_id || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 过滤事件列表。
 *
 * @param {Object[]} events - 事件列表
 * @param {Object} filter - 过滤条件
 * @param {EventType} [filter.event_type] - 按类型过滤
 * @param {string} [filter.gene_id] - 按 Gene ID 过滤
 * @param {string} [filter.since] - 起始时间 ISO 字符串
 * @returns {Object[]} 过滤后的事件
 */
function filterEvents(events, filter) {
  return events.filter(e => {
    if (filter.event_type && e.event_type !== filter.event_type) return false;
    if (filter.gene_id && e.gene_id !== filter.gene_id) return false;
    if (filter.since && e.timestamp < filter.since) return false;
    return true;
  });
}

/**
 * 汇总事件统计。
 *
 * @param {Object[]} events - 事件列表
 * @returns {Object} 各类型事件计数
 */
function summarizeEvents(events) {
  const summary = {};
  for (const e of events) {
    summary[e.event_type] = (summary[e.event_type] || 0) + 1;
  }
  return summary;
}

module.exports = { createEvent, filterEvents, summarizeEvents };
