'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * 信号提取器。
 *
 * 从 OpenClaw session logs 提取进化信号，驱动 Gene 选择与变异决策。
 *
 * OpenClaw session log 条目格式（JSONL）：
 *   { type: "session"|"message"|"model_change"|"thinking_level_change"|"custom", ... }
 *   message 条目: { type: "message", message: { role, content, stopReason, errorMessage, usage } }
 *
 * 信号类型：
 * - 错误信号：log_error, errsig:<detail>, recurring_error
 * - 机会信号：user_feature_request, capability_gap, stable_success_plateau
 * - 工具信号：high_tool_usage:<tool>, repeated_tool_usage:<tool>
 * - 停滞信号：evolution_stagnation, repair_loop_detected, empty_cycle_loop
 * - 能力信号：capability_candidate:<name>, capability_underused:<id>
 */

/** @type {RegExp} 匹配 feature/ability/add/功能/能力/添加 关键词 */
const FEATURE_KEYWORDS = /\b(feature|ability|add|功能|能力|添加)\b/i;

/**
 * 从 message 条目中提取文本内容。
 *
 * @param {Object} entry - session log 条目
 * @returns {string} 提取到的文本
 */
function extractText(entry) {
  const msg = entry.message;
  if (!msg) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join(' ');
  }
  return '';
}

/**
 * 从 session log 条目数组提取信号。
 *
 * 兼容两种格式：
 * 1. OpenClaw 原生格式 (type: "message", message: { role, content, stopReason, errorMessage })
 * 2. 简化格式 (level/type: "error", detail, tool_name, status 等)
 *
 * @param {Object[]} entries - session log 条目（JSONL 解析后）
 * @returns {string[]} 提取到的信号列表（去重）
 */
function extractSignals(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const signals = new Set();

  // --- 错误信号 ---
  const errorDetailCounts = new Map();
  for (const entry of entries) {
    // OpenClaw 原生格式：message.stopReason === 'error' 或 message.errorMessage 存在
    if (entry.type === 'message' && entry.message) {
      const msg = entry.message;
      if (msg.stopReason === 'error' || msg.errorMessage) {
        signals.add('log_error');
        // 提取错误详情
        const detail = msg.errorMessage || msg.stopReason || '';
        if (detail) {
          // 从 errorMessage 中提取关键部分（去掉 JSON 包装）
          const shortDetail = detail.length > 80 ? detail.slice(0, 80) : detail;
          const normalized = shortDetail.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_').slice(0, 50);
          signals.add(`errsig:${normalized}`);
          errorDetailCounts.set(
            normalized,
            (errorDetailCounts.get(normalized) || 0) + 1,
          );
        }
      }
    }

    // 简化格式兼容
    if (entry.level === 'error' || (entry.type === 'error' && !entry.message)) {
      signals.add('log_error');
      if (entry.detail) {
        signals.add(`errsig:${entry.detail}`);
        errorDetailCounts.set(
          entry.detail,
          (errorDetailCounts.get(entry.detail) || 0) + 1,
        );
      }
    }
  }
  for (const [, count] of errorDetailCounts) {
    if (count >= 3) {
      signals.add('recurring_error');
      break;
    }
  }

  // --- 机会信号 ---
  for (const entry of entries) {
    // OpenClaw 格式：用户消息中包含功能请求关键词
    if (entry.type === 'message' && entry.message?.role === 'user') {
      const text = extractText(entry);
      if (FEATURE_KEYWORDS.test(text)) {
        signals.add('user_feature_request');
      }
    }

    // 简化格式兼容
    if (entry.type === 'user_request' && typeof entry.message === 'string') {
      if (FEATURE_KEYWORDS.test(entry.message)) {
        signals.add('user_feature_request');
      }
    }
  }

  // stable_success_plateau：最近 10 条 assistant 消息全部无错误
  const assistantMsgs = entries.filter(
    e => e.type === 'message' && e.message?.role === 'assistant',
  );
  if (assistantMsgs.length >= 10) {
    const recent10 = assistantMsgs.slice(-10);
    const allSuccess = recent10.every(
      e => e.message?.stopReason !== 'error' && !e.message?.errorMessage,
    );
    if (allSuccess) {
      signals.add('stable_success_plateau');
    }
  }

  // 简化格式兼容
  if (entries.length >= 10) {
    const recent10 = entries.slice(-10);
    const allStatusSuccess = recent10.every(
      e => e.status === 'success' || e.result === 'success',
    );
    if (allStatusSuccess && !signals.has('stable_success_plateau')) {
      signals.add('stable_success_plateau');
    }
  }

  // --- 工具信号 ---
  const toolCounts = new Map();
  for (const entry of entries) {
    // OpenClaw 格式：tool_use content blocks
    if (entry.type === 'message' && entry.message?.role === 'assistant') {
      const content = entry.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && block.name) {
            toolCounts.set(block.name, (toolCounts.get(block.name) || 0) + 1);
          }
        }
      }
    }
    // 简化格式
    if (entry.tool_name) {
      toolCounts.set(entry.tool_name, (toolCounts.get(entry.tool_name) || 0) + 1);
    }
  }
  for (const [tool, count] of toolCounts) {
    if (count >= 5) {
      signals.add(`high_tool_usage:${tool}`);
    }
  }

  // repeated_tool_usage：从 tool_use blocks 中提取连续工具使用
  const toolSequence = [];
  for (const entry of entries) {
    if (entry.type === 'message' && entry.message?.role === 'assistant') {
      const content = entry.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && block.name) {
            toolSequence.push(block.name);
          }
        }
      }
    }
    if (entry.tool_name) {
      toolSequence.push(entry.tool_name);
    }
  }
  let repeatCount = 1;
  for (let i = 1; i < toolSequence.length; i++) {
    if (toolSequence[i] === toolSequence[i - 1]) {
      repeatCount++;
      if (repeatCount >= 3) {
        signals.add(`repeated_tool_usage:${toolSequence[i]}`);
      }
    } else {
      repeatCount = 1;
    }
  }

  // --- 停滞信号 ---
  let solidifyFailCount = 0;
  for (const entry of entries) {
    if (entry.mutation_applied && entry.solidify_failed) {
      solidifyFailCount++;
    }
  }
  if (solidifyFailCount >= 3) {
    signals.add('repair_loop_detected');
  }

  // 检测 OpenClaw session 中的全错误模式（所有 assistant 消息都失败）
  if (assistantMsgs.length >= 5) {
    const allError = assistantMsgs.every(
      e => e.message?.stopReason === 'error' || !!e.message?.errorMessage,
    );
    if (allError) {
      signals.add('recurring_error');
      signals.add('evolution_stagnation');
    }
  }

  // --- 能力信号 ---
  for (const entry of entries) {
    if (entry.type === 'capability_mention' && entry.name) {
      signals.add(`capability_candidate:${entry.name}`);
    }
    // OpenClaw custom 事件
    if (entry.type === 'custom' && entry.customType === 'capability_mention' && entry.data?.name) {
      signals.add(`capability_candidate:${entry.data.name}`);
    }
  }

  return [...signals];
}

/**
 * 解析单个 JSONL 文件内容为条目数组。
 *
 * @param {string} content - JSONL 文件原始内容
 * @returns {Object[]} 解析后的条目
 */
function parseJSONL(content) {
  if (!content || !content.trim()) return [];
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * 从文件系统读取 session logs 并提取信号。
 *
 * @param {string} sessionsDir - sessions 目录路径
 * @returns {string[]} 提取到的信号列表（去重）
 */
function extractFromSessions(sessionsDir) {
  if (!fs.existsSync(sessionsDir)) return [];

  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
  if (files.length === 0) return [];

  const allEntries = [];
  for (const file of files) {
    const filepath = path.join(sessionsDir, file);
    const content = fs.readFileSync(filepath, 'utf-8');
    const entries = parseJSONL(content);
    allEntries.push(...entries);
  }

  return extractSignals(allEntries);
}

module.exports = { extractSignals, extractFromSessions };
