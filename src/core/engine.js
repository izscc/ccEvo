'use strict';

/**
 * 进化引擎主循环。
 *
 * 整合信号提取 → Gene 选择 → 变异 → 固化的完整进化流程。
 */

const { extractSignals, extractFromSessions } = require('./signals');
const { selectGene } = require('./selector');
const { createMutation, checkStrategyAllowance } = require('../gep/mutation');
const { createEvent } = require('../gep/event');
const { loadGenes, appendEvent, loadEvents, loadCapsules } = require('../gep/store');
const { solidify } = require('./solidify');
const { getStrategy, autoDetectStrategy } = require('../strategy');
const { createPersonality, updatePersonality, suggestFromPersonality } = require('../personality');
const { computeVScore, isWorthEvolving } = require('../vfm/scorer');

/**
 * 进化引擎。
 */
class EvolutionEngine {
  /**
   * @param {Object} options - 引擎选项
   * @param {string} [options.strategy] - 策略名称（null=自动检测）
   * @param {string} [options.agentName] - OpenClaw agent 名称
   * @param {string} [options.sessionsDir] - 自定义 sessions 目录
   * @param {string} [options.cwd] - 工作目录
   * @param {boolean} [options.dryRun=false] - 干运行模式
   * @param {boolean} [options.verbose=false] - 详细输出
   */
  constructor(options = {}) {
    this.options = options;
    this.personality = createPersonality();
    this.cycleCount = 0;
  }

  /**
   * 执行一轮完整进化周期。
   *
   * @returns {Promise<Object>} 进化结果
   */
  async runCycle() {
    const result = {
      cycle: ++this.cycleCount,
      signals: [],
      gene: null,
      mutation: null,
      solidifyResult: null,
      skipped: false,
      reason: null,
    };

    // 1. 提取信号
    result.signals = this._extractSignals();
    if (result.signals.length === 0) {
      result.skipped = true;
      result.reason = 'no_signals';
      this._log('No signals extracted, cycle skipped');
      return result;
    }

    appendEvent(createEvent({
      event_type: 'signal_extracted',
      payload: { signals: result.signals, count: result.signals.length },
    }));
    this._log(`Extracted ${result.signals.length} signals: ${result.signals.join(', ')}`);

    // 2. 确定策略
    const events = loadEvents();
    const strategyName = this.options.strategy || autoDetectStrategy(events);
    const strategy = getStrategy(strategyName);
    this._log(`Strategy: ${strategyName}`);

    // 3. 人格建议
    const personalitySuggestion = suggestFromPersonality(this.personality);

    // 4. 选择 Gene
    result.gene = selectGene(result.signals, {
      preferCategory: personalitySuggestion.preferCategory,
    });

    if (!result.gene) {
      result.skipped = true;
      result.reason = 'no_matching_gene';
      this._log('No matching gene found');
      return result;
    }

    appendEvent(createEvent({
      event_type: 'gene_selected',
      payload: { gene_id: result.gene.id, category: result.gene.category },
      gene_id: result.gene.id,
    }));
    this._log(`Selected gene: ${result.gene.id} (${result.gene.category})`);

    // 5. 策略允许检查
    const capsules = loadCapsules();
    const recentMutationEvents = events
      .filter(e => e.event_type === 'mutation_applied')
      .slice(-10);
    const allowance = checkStrategyAllowance(
      result.gene.category,
      strategy,
      recentMutationEvents.map(e => e.payload),
    );

    if (!allowance.allowed) {
      result.skipped = true;
      result.reason = `strategy_blocked: ${allowance.reason}`;
      this._log(`Strategy blocked: ${allowance.reason}`);
      return result;
    }

    // 6. VFM 检查（如果关联能力节点）
    if (result.gene.capability_node_id && result.gene.v_score !== null) {
      if (!isWorthEvolving(result.gene.v_score)) {
        result.skipped = true;
        result.reason = `low_v_score: ${result.gene.v_score}`;
        this._log(`V-Score too low: ${result.gene.v_score}`);
        return result;
      }
    }

    // 7. 创建变异提案
    result.mutation = createMutation({
      category: result.gene.category,
      trigger_signals: result.signals,
      target: result.gene.strategy.join(' → '),
      expected_effect: `Execute gene ${result.gene.id}: ${result.gene.strategy.slice(0, 2).join(', ')}`,
      gene_id: result.gene.id,
    });

    appendEvent(createEvent({
      event_type: 'mutation_applied',
      payload: {
        category: result.mutation.category,
        target: result.mutation.target,
        risk_level: result.mutation.risk_level,
      },
      gene_id: result.gene.id,
    }));

    // 8. 固化
    result.solidifyResult = await solidify({
      gene: result.gene,
      mutation: result.mutation,
      changedFiles: [],
      newFiles: [],
      lineStats: { additions: 0, deletions: 0 },
      dryRun: this.options.dryRun,
      cwd: this.options.cwd,
    });

    // 9. 更新人格
    this.personality = updatePersonality(this.personality, {
      success: result.solidifyResult.success,
      category: result.gene.category,
    });

    this._log(
      result.solidifyResult.success
        ? `Solidify success: ${result.gene.id}`
        : `Solidify failed: ${result.solidifyResult.adl?.violations?.join(', ') || 'validation'}`,
    );

    return result;
  }

  /**
   * 提取信号。
   *
   * @returns {string[]}
   * @private
   */
  _extractSignals() {
    if (this.options.sessionsDir) {
      return extractFromSessions(this.options.sessionsDir);
    }
    // 如果没有指定 sessions 目录，从事件历史中推断信号
    const events = loadEvents();
    if (events.length === 0) return [];

    const signals = [];
    const recent = events.slice(-20);

    // 从事件中推断信号
    const failCount = recent.filter(e => e.event_type === 'solidify_failed').length;
    const rollbackCount = recent.filter(e => e.event_type === 'rollback').length;

    if (failCount >= 3) signals.push('recurring_error');
    if (rollbackCount >= 3) signals.push('repair_loop_detected');
    if (recent.every(e => e.event_type === 'solidify_success')) signals.push('stable_success_plateau');
    if (recent.length === 0 || recent.every(e => e.event_type === 'signal_extracted')) {
      signals.push('evolution_stagnation');
    }

    return signals;
  }

  /**
   * 输出日志。
   *
   * @param {string} msg
   * @private
   */
  _log(msg) {
    if (this.options.verbose) {
      console.log(`[ccEvo] ${msg}`);
    }
  }

  /**
   * 获取引擎状态。
   *
   * @returns {Object}
   */
  getStatus() {
    return {
      cycleCount: this.cycleCount,
      personality: this.personality,
      genesCount: loadGenes().length,
      capsulesCount: loadCapsules().length,
      eventsCount: loadEvents().length,
    };
  }
}

module.exports = { EvolutionEngine };
