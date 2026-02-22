'use strict';

/**
 * PCEC 定时调度器。
 *
 * 管理 PCEC 周期的定时触发，支持适应性间隔调整。
 */

/**
 * PCEC 调度器。
 *
 * 提供 start/stop 控制、单次执行、适应性间隔调整
 * 以及状态查询。
 */
class PCECScheduler {
  /**
   * 创建调度器实例。
   *
   * @param {Object} [options] - 调度器选项
   * @param {number} [options.intervalMs] - 周期间隔（毫秒），默认 3 小时
   * @param {number} [options.minIntervalMs] - 最小间隔（毫秒），默认 30 分钟
   * @param {number} [options.maxIntervalMs] - 最大间隔（毫秒），默认 6 小时
   * @param {Function} [options.onCycle] - 周期回调函数
   */
  constructor(options = {}) {
    this.intervalMs =
      options.intervalMs ||
      parseInt(process.env.PCEC_INTERVAL_MS || '10800000', 10);
    this.minIntervalMs = options.minIntervalMs || 1800000;  // 30min
    this.maxIntervalMs = options.maxIntervalMs || 21600000; // 6h
    this.timer = null;
    this.running = false;
    this.cycleCallback = options.onCycle || null;
    this.cycleCount = 0;
  }

  /**
   * 启动定时器。
   *
   * 如果已在运行则忽略。启动后按 intervalMs 间隔循环执行周期回调。
   */
  start() {
    if (this.running) return;

    this.running = true;
    this._scheduleNext();
  }

  /**
   * 停止定时器。
   *
   * 清除计时器并标记为停止状态。
   */
  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 执行单次周期。
   *
   * 不依赖定时器，直接触发一次周期回调。
   *
   * @returns {Promise<*>} 回调的返回值
   */
  async runOnce() {
    this.cycleCount += 1;

    if (typeof this.cycleCallback === 'function') {
      return await this.cycleCallback(this.cycleCount);
    }
    return null;
  }

  /**
   * 适应性调整间隔。
   *
   * 根据当前活跃程度动态调整周期间隔：
   * - active: 缩短 20%（不低于 minIntervalMs）
   * - idle: 保持不变
   * - saturated: 延长 30%（不超过 maxIntervalMs）
   *
   * @param {'active'|'idle'|'saturated'} activityLevel - 当前活跃程度
   */
  adjustInterval(activityLevel) {
    switch (activityLevel) {
      case 'active':
        this.intervalMs = Math.max(
          this.minIntervalMs,
          Math.floor(this.intervalMs * 0.8)
        );
        break;
      case 'idle':
        // 不变
        break;
      case 'saturated':
        this.intervalMs = Math.min(
          this.maxIntervalMs,
          Math.floor(this.intervalMs * 1.3)
        );
        break;
      default:
        // 未知级别，不调整
        break;
    }
  }

  /**
   * 获取调度器状态。
   *
   * @returns {{ running: boolean, intervalMs: number, cycleCount: number, minIntervalMs: number, maxIntervalMs: number }}
   */
  getStatus() {
    return {
      running: this.running,
      intervalMs: this.intervalMs,
      cycleCount: this.cycleCount,
      minIntervalMs: this.minIntervalMs,
      maxIntervalMs: this.maxIntervalMs,
    };
  }

  /**
   * 内部方法：调度下一次周期执行。
   *
   * @private
   */
  _scheduleNext() {
    if (!this.running) return;

    this.timer = setTimeout(async () => {
      try {
        await this.runOnce();
      } catch (err) {
        // 周期执行失败不影响调度继续
      }
      this._scheduleNext();
    }, this.intervalMs);

    // 允许 Node.js 进程在只剩定时器时自然退出
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }
}

module.exports = { PCECScheduler };
