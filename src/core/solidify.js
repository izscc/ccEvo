'use strict';

const { execSync } = require('node:child_process');

/**
 * 固化协议 (Solidify Protocol)。
 *
 * 补丁应用后的验证闭环：
 * 1. 计算 blast radius
 * 2. 执行 Gene validation 命令
 * 3. ADL 约束检查
 * 4. 通过 → Capsule + Event | 失败 → 回滚
 */

/**
 * 计算变更的爆炸半径。
 *
 * @param {string[]} changedFiles - 变更文件列表
 * @param {Object} [lineStats] - 行统计 { additions: number, deletions: number }
 * @returns {{ files: number, lines: number }}
 */
function computeBlast(changedFiles, lineStats) {
  return {
    files: changedFiles ? changedFiles.length : 0,
    lines: lineStats ? (lineStats.additions || 0) + (lineStats.deletions || 0) : 0,
  };
}

/**
 * 执行验证命令列表。
 *
 * @param {string[]} commands - 验证命令
 * @param {string} [cwd] - 工作目录
 * @param {number} [timeoutMs=30000] - 超时（毫秒）
 * @returns {{ passed: boolean, results: Array<{ command: string, success: boolean, output: string }> }}
 */
function runValidations(commands, cwd, timeoutMs = 30000) {
  if (!commands || commands.length === 0) {
    return { passed: true, results: [] };
  }

  const results = [];
  let allPassed = true;

  for (const cmd of commands) {
    try {
      const output = execSync(cmd, {
        cwd: cwd || process.cwd(),
        timeout: timeoutMs,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      results.push({ command: cmd, success: true, output: output.trim() });
    } catch (err) {
      allPassed = false;
      results.push({
        command: cmd,
        success: false,
        output: err.stderr ? err.stderr.toString().trim() : err.message,
      });
    }
  }

  return { passed: allPassed, results };
}

/**
 * 执行完整的固化流程。
 *
 * @param {Object} params - 固化参数
 * @param {Object} params.gene - 触发 Gene
 * @param {Object} params.mutation - 变异提案
 * @param {string[]} params.changedFiles - 变更文件
 * @param {string[]} [params.newFiles] - 新增文件
 * @param {Object} [params.lineStats] - 行统计
 * @param {boolean} [params.dryRun=false] - 干运行模式
 * @param {string} [params.cwd] - 工作目录
 * @returns {Promise<{ success: boolean, blast: Object, validation: Object, adl: Object|null, capsule: Object|null, event: Object|null }>}
 */
async function solidify(params) {
  // 延迟加载，避免循环依赖
  const { checkADL } = require('./adl/lock');
  const { rollback } = require('./adl/rollback');
  const { createCapsule } = require('../gep/capsule');
  const { createEvent } = require('../gep/event');
  const { addCapsule, appendEvent, loadCapsules } = require('../gep/store');

  // 1. 计算 blast radius
  const blast = computeBlast(params.changedFiles, params.lineStats);

  // 2. 执行验证命令
  const validation = runValidations(
    params.gene.validation,
    params.cwd,
  );

  if (!validation.passed) {
    const failEvent = createEvent({
      event_type: 'solidify_failed',
      payload: {
        reason: 'validation_failed',
        blast,
        validation_results: validation.results,
      },
      gene_id: params.gene.id,
    });
    appendEvent(failEvent);

    // 回滚
    if (!params.dryRun) {
      rollback(params.cwd || process.cwd(), params.changedFiles || [], params.newFiles || []);
      appendEvent(createEvent({
        event_type: 'rollback',
        payload: { trigger: 'validation_failed', gene_id: params.gene.id },
        gene_id: params.gene.id,
      }));
    }

    return { success: false, blast, validation, adl: null, capsule: null, event: failEvent };
  }

  // 3. ADL 约束检查
  const capsuleHistory = loadCapsules();
  const adl = checkADL(params.mutation, blast, capsuleHistory);

  if (!adl.ok) {
    const failEvent = createEvent({
      event_type: 'adl_violation',
      payload: { violations: adl.violations, blast },
      gene_id: params.gene.id,
    });
    appendEvent(failEvent);

    // 回滚
    if (!params.dryRun) {
      rollback(params.cwd || process.cwd(), params.changedFiles || [], params.newFiles || []);
      appendEvent(createEvent({
        event_type: 'rollback',
        payload: { trigger: 'adl_violation', gene_id: params.gene.id },
        gene_id: params.gene.id,
      }));
    }

    return { success: false, blast, validation, adl, capsule: null, event: failEvent };
  }

  // 4. 成功 → 生成 Capsule + Event
  if (params.dryRun) {
    return { success: true, blast, validation, adl, capsule: null, event: null };
  }

  const capsule = createCapsule({
    gene_id: params.gene.id,
    mutation_category: params.mutation.category,
    signals: params.mutation.trigger_signals,
    files_changed: params.changedFiles,
    summary: params.mutation.expected_effect,
    metrics: {
      blast_files: blast.files,
      blast_lines: blast.lines,
      validation_passed: true,
    },
  });
  addCapsule(capsule);

  const successEvent = createEvent({
    event_type: 'solidify_success',
    payload: { capsule_id: capsule.id, blast },
    gene_id: params.gene.id,
  });
  appendEvent(successEvent);

  return { success: true, blast, validation, adl, capsule, event: successEvent };
}

module.exports = { computeBlast, runValidations, solidify };
