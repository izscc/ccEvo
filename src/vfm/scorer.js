'use strict';

/**
 * V-Score 评分器 (Value Function Scorer)。
 *
 * 对能力节点计算综合价值分数（0-100），
 * 基于四个维度：复用频率、降低失败率、降低用户心智负担、降低自身推理成本。
 */

const { loadGenes } = require('../gep/store');

/** @constant {number} 进化价值阈值，低于此分数不值得进化 */
const EVOLUTION_THRESHOLD = 40;

/**
 * 频率维度评分。
 *
 * 使用 log2(trigger_count + 1) 归一化到 0-10，上限为 10。
 *
 * @param {Object} capability - 能力节点
 * @returns {number} 0-10 的分数
 */
function scoreFrequency(capability) {
  const count = capability.trigger_count || 0;
  const raw = Math.log2(count + 1);
  return Math.min(raw, 10);
}

/**
 * 降低失败率维度评分。
 *
 * 该能力关联 capsule 的 validation_passed 成功率映射到 0-10。
 * 成功率越高说明能力越稳定，对降低失败有贡献。
 *
 * @param {Object} capability - 能力节点
 * @param {Object[]} capsules - 相关 Capsule 列表
 * @returns {number} 0-10 的分数
 */
function scoreFailReduction(capability, capsules) {
  if (!capsules || capsules.length === 0) return 0;

  // 筛选出与该能力关联 gene 相关的 capsule
  const linkedGenes = new Set(capability.linked_genes || []);
  const relatedCapsules = capsules.filter(c => linkedGenes.has(c.gene_id));

  if (relatedCapsules.length === 0) return 0;

  const passedCount = relatedCapsules.filter(c => c.metrics && c.metrics.validation_passed).length;
  const successRate = passedCount / relatedCapsules.length;
  return successRate * 10;
}

/**
 * 降低用户心智负担维度评分。
 *
 * 如果有 linked_skills（自动化能力）且 preconditions 少则得高分。
 * 自动化程度高 = 用户负担低。
 *
 * @param {Object} capability - 能力节点
 * @returns {number} 0-10 的分数
 */
function scoreUserBurden(capability) {
  const skillCount = (capability.linked_skills || []).length;
  const precondCount = (capability.preconditions || []).length;

  // 有 linked_skills 说明自动化程度高
  let score = 0;

  // 每个 skill 贡献 2 分，上限 6 分
  score += Math.min(skillCount * 2, 6);

  // preconditions 少说明使用门槛低，0 个前置条件得满分 4，每多一个减 1
  score += Math.max(4 - precondCount, 0);

  return Math.min(score, 10);
}

/**
 * 降低自身推理成本维度评分。
 *
 * 如果关联 gene 的 strategy 步骤少且 constraints.max_files 小则得高分。
 * 简洁的策略 = 低推理成本。
 *
 * @param {Object} capability - 能力节点
 * @returns {number} 0-10 的分数
 */
function scoreSelfCost(capability) {
  const linkedGeneIds = capability.linked_genes || [];
  if (linkedGeneIds.length === 0) return 5; // 无关联 gene 给中等分

  const genes = loadGenes();
  const geneMap = {};
  for (const g of genes) {
    geneMap[g.id] = g;
  }

  let totalSteps = 0;
  let totalMaxFiles = 0;
  let geneCount = 0;

  for (const geneId of linkedGeneIds) {
    const gene = geneMap[geneId];
    if (!gene) continue;
    geneCount++;
    totalSteps += (gene.strategy || []).length;
    totalMaxFiles += (gene.constraints && gene.constraints.max_files) || 12;
  }

  if (geneCount === 0) return 5;

  const avgSteps = totalSteps / geneCount;
  const avgMaxFiles = totalMaxFiles / geneCount;

  // 步骤越少分数越高：1步=10分，10步以上=0分
  const stepScore = Math.max(10 - avgSteps, 0);

  // max_files 越少分数越高：1文件=10分，20文件以上=0分
  const fileScore = Math.max(10 - (avgMaxFiles / 2), 0);

  return Math.min((stepScore + fileScore) / 2, 10);
}

/**
 * 计算能力的 V-Score。
 *
 * 四个维度加权求和后归一化到 0-100：
 * - frequency (权重 3x)：复用频率
 * - failReduce (权重 3x)：降低失败率
 * - userBurden (权重 2x)：降低用户心智负担
 * - selfCost (权重 2x)：降低自身推理成本
 *
 * @param {Object} capability - 能力节点
 * @param {Object} context - 上下文数据
 * @param {Object[]} context.capsules - 相关 Capsule
 * @param {Object[]} context.events - 相关事件
 * @param {Object} [weights] - 自定义权重
 * @param {number} [weights.frequency] - 频率权重
 * @param {number} [weights.failReduce] - 失败降低权重
 * @param {number} [weights.userBurden] - 用户负担权重
 * @param {number} [weights.selfCost] - 自身成本权重
 * @returns {number} 0-100 的分数
 */
function computeVScore(capability, context, weights) {
  const w = weights || { frequency: 3, failReduce: 3, userBurden: 2, selfCost: 2 };
  const capsules = (context && context.capsules) || [];

  const frequency   = scoreFrequency(capability)               * w.frequency;
  const failReduce  = scoreFailReduction(capability, capsules)  * w.failReduce;
  const userBurden  = scoreUserBurden(capability)               * w.userBurden;
  const selfCost    = scoreSelfCost(capability)                 * w.selfCost;

  const totalWeight = w.frequency + w.failReduce + w.userBurden + w.selfCost;
  const maxScore = 10 * totalWeight; // 每个维度满分 10 * 权重
  const rawScore = frequency + failReduce + userBurden + selfCost;

  // 归一化到 0-100
  const normalized = (rawScore / maxScore) * 100;
  return Math.round(Math.min(Math.max(normalized, 0), 100));
}

/**
 * 判断能力是否值得进化。
 *
 * @param {number} score - V-Score 分数
 * @returns {boolean} 是否超过进化阈值
 */
function isWorthEvolving(score) {
  return score >= EVOLUTION_THRESHOLD;
}

module.exports = {
  computeVScore,
  isWorthEvolving,
  scoreFrequency,
  scoreFailReduction,
  scoreUserBurden,
  scoreSelfCost,
  EVOLUTION_THRESHOLD,
};
