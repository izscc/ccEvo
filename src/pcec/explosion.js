'use strict';

/**
 * PCEC 思维爆炸。
 *
 * 当系统停滞或需要突破时，生成发散性思考 prompt，
 * 并从 AI 生成的爆炸结果中提取可执行项。
 */

/** 基础思维爆炸问题 */
const EXPLOSION_QUESTIONS = [
  '如果彻底推翻当前默认做法，会发生什么？',
  '如果是系统设计者而非执行者，会删掉什么？',
  '如果让能力弱 10 倍的 agent 也能成功，需要补什么？',
  '如果这个能力被调用 1000 次，现在的设计是否必然崩溃？',
  '当前最大的隐性假设是什么？如果它是错的呢？',
  '哪些步骤可以完全自动化，使其永远不需要人类介入？',
  '如果从零重建这个能力，最小可行版本是什么？',
  '当前方案中，哪些部分只是习惯而非必要？',
];

/** 停滞时追加的激进问题 */
const STAGNANT_QUESTIONS = [
  '最近两个周期没有实质产出，系统是否陷入了"看起来在工作"的假象？',
  '如果强制要求这个周期必须改变一件事，最值得改变的是什么？',
  '是否存在某个能力已经过时，应该直接废弃而非修补？',
];

/** 失败频发时追加的修复导向问题 */
const FAILURE_QUESTIONS = [
  '最近频繁失败的根因是什么？是否在反复踩同一个坑？',
  '哪些失败可以通过增加前置检查完全避免？',
  '是否需要回退到一个已知稳定的状态，重新出发？',
];

/**
 * 从数组中随机选取 n 个不重复元素。
 *
 * @param {Array} arr - 源数组
 * @param {number} n - 选取数量
 * @returns {Array} 选取的元素
 * @private
 */
function _pickRandom(arr, n) {
  const copy = arr.slice();
  const result = [];
  const count = Math.min(n, copy.length);

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }

  return result;
}

/**
 * 生成思维爆炸 prompt。
 *
 * 根据上下文（停滞周期数、近期失败）动态组装问题集，
 * 从中随机选取 3-4 个问题，生成聚焦的 prompt。
 *
 * @param {Object} context - 上下文信息
 * @param {string[]} context.currentCapabilities - 当前已有能力列表
 * @param {string[]} context.recentFailures - 近期失败记录
 * @param {number} context.stagnantCycles - 连续停滞周期数
 * @returns {{ questions: string[], focusArea: string, prompt: string }}
 */
function generateExplosion(context) {
  const {
    currentCapabilities = [],
    recentFailures = [],
    stagnantCycles = 0,
  } = context || {};

  // 组装候选问题池
  let pool = EXPLOSION_QUESTIONS.slice();

  if (stagnantCycles > 0) {
    pool = pool.concat(STAGNANT_QUESTIONS);
  }

  if (recentFailures.length > 2) {
    pool = pool.concat(FAILURE_QUESTIONS);
  }

  // 随机选取 3-4 个问题
  const pickCount = stagnantCycles > 1 ? 4 : 3;
  const questions = _pickRandom(pool, pickCount);

  // 确定聚焦领域
  let focusArea = '通用能力提升';
  if (stagnantCycles > 1) {
    focusArea = '突破停滞';
  } else if (recentFailures.length > 2) {
    focusArea = '失败根因分析与修复';
  } else if (currentCapabilities.length === 0) {
    focusArea = '基础能力建设';
  }

  // 组装 prompt
  const capabilitiesText =
    currentCapabilities.length > 0
      ? `当前已有能力：${currentCapabilities.join('、')}`
      : '当前无已注册能力。';

  const failuresText =
    recentFailures.length > 0
      ? `\n近期失败记录：\n${recentFailures.map((f) => `- ${f}`).join('\n')}`
      : '';

  const stagnantText =
    stagnantCycles > 0
      ? `\n警告：已连续 ${stagnantCycles} 个周期无实质产出。`
      : '';

  const questionsText = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n');

  const prompt = [
    `## 思维爆炸 - 聚焦：${focusArea}`,
    '',
    capabilitiesText,
    failuresText,
    stagnantText,
    '',
    '请深入思考以下问题，给出具体可执行的想法：',
    '',
    questionsText,
    '',
    '要求：',
    '- 每个回答必须包含至少一个具体的 ACTION 项（用 "ACTION:" 开头）',
    '- 避免泛泛而谈，给出可直接实施的步骤',
    '- 如果某个问题触发了新的重要洞察，用 "INSIGHT:" 标记',
  ].join('\n');

  return { questions, focusArea, prompt };
}

/**
 * 从思维爆炸结果中提取可执行项。
 *
 * 提取规则：
 * - 以 "- [ ]"、"TODO:"、"ACTION:" 开头的行作为 actionable
 * - 其余有意义的行（非空、非纯标点、长度 > 5）作为 insights
 *
 * @param {string} explosionResult - AI 生成的爆炸结果文本
 * @returns {{ actionable: string[], insights: string[] }}
 */
function extractActionables(explosionResult) {
  const actionable = [];
  const insights = [];

  if (!explosionResult || typeof explosionResult !== 'string') {
    return { actionable, insights };
  }

  const lines = explosionResult.split('\n');

  /** 匹配可执行项的模式 */
  const actionPatterns = [
    /^\s*-\s*\[\s*\]\s*/,   // - [ ] 开头
    /^\s*TODO:\s*/i,         // TODO: 开头
    /^\s*ACTION:\s*/i,       // ACTION: 开头
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let isAction = false;
    for (const pattern of actionPatterns) {
      if (pattern.test(line)) {
        // 去掉前缀，保留内容
        const content = line.replace(pattern, '').trim();
        if (content.length > 0) {
          actionable.push(content);
        }
        isAction = true;
        break;
      }
    }

    if (!isAction && line.length > 5) {
      // 排除纯标题行（只有 # 和空格）和分隔线
      if (/^#{1,6}\s*$/.test(line) || /^[-=]{3,}$/.test(line)) {
        continue;
      }
      insights.push(line);
    }
  }

  return { actionable, insights };
}

module.exports = {
  EXPLOSION_QUESTIONS,
  generateExplosion,
  extractActionables,
};
