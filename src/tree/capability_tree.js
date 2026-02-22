'use strict';

/**
 * 能力树 (Capability Tree) 操作。
 *
 * 管理层级化的能力图谱，支持节点的增删改查、合并、修剪和信号路径查找。
 */

const { loadCapabilityTree, saveCapabilityTree, loadGenes } = require('../gep/store');
const { createNode, validateNode, touchNode } = require('./node');

class CapabilityTree {
  /**
   * 初始化能力树，从持久化存储加载数据。
   */
  constructor() {
    this.data = loadCapabilityTree();
    // 确保基本结构存在
    if (!this.data.root) {
      this.data.root = { id: 'cap', name: 'Root', level: 'high', parent_id: null, children: [] };
    }
    if (!this.data.nodes) {
      this.data.nodes = {};
    }
  }

  /**
   * 添加新节点到能力树。
   *
   * 将节点挂载到已有父节点下。如果父节点不存在则抛出错误。
   *
   * @param {Object} node - 由 createNode 创建的能力节点
   * @throws {Error} 父节点不存在或节点 ID 已存在
   */
  addNode(node) {
    const validation = validateNode(node);
    if (!validation.valid) {
      throw new Error(`Invalid node: ${validation.errors.join(', ')}`);
    }
    if (this.data.nodes[node.id]) {
      throw new Error(`Node already exists: ${node.id}`);
    }

    // 查找父节点
    const parentId = node.parent_id;
    if (parentId === this.data.root.id) {
      // 挂载到根节点
      this.data.root.children.push(node.id);
    } else if (this.data.nodes[parentId]) {
      // 挂载到普通节点
      if (!Array.isArray(this.data.nodes[parentId].children)) {
        this.data.nodes[parentId].children = [];
      }
      this.data.nodes[parentId].children.push(node.id);
    } else {
      throw new Error(`Parent node not found: ${parentId}`);
    }

    this.data.nodes[node.id] = node;
  }

  /**
   * 移除节点及其所有子节点。
   *
   * 从父节点的 children 中移除引用，并递归删除所有子节点。
   *
   * @param {string} id - 要移除的节点 ID
   * @returns {boolean} 是否成功移除
   */
  removeNode(id) {
    const node = this.data.nodes[id];
    if (!node) return false;

    // 递归移除所有子节点
    const childIds = Array.isArray(node.children) ? [...node.children] : [];
    for (const childId of childIds) {
      this.removeNode(childId);
    }

    // 从父节点的 children 中移除引用
    const parentId = node.parent_id;
    if (parentId === this.data.root.id) {
      this.data.root.children = this.data.root.children.filter(cid => cid !== id);
    } else if (this.data.nodes[parentId]) {
      this.data.nodes[parentId].children = this.data.nodes[parentId].children.filter(cid => cid !== id);
    }

    delete this.data.nodes[id];
    return true;
  }

  /**
   * 获取指定节点。
   *
   * @param {string} id - 节点 ID
   * @returns {Object|null} 节点对象或 null
   */
  getNode(id) {
    if (id === this.data.root.id) return this.data.root;
    return this.data.nodes[id] || null;
  }

  /**
   * 获取直接子节点列表。
   *
   * @param {string} id - 父节点 ID
   * @returns {Object[]} 子节点对象数组
   */
  getChildren(id) {
    let childIds;
    if (id === this.data.root.id) {
      childIds = this.data.root.children || [];
    } else {
      const node = this.data.nodes[id];
      if (!node) return [];
      childIds = node.children || [];
    }
    return childIds
      .map(cid => this.data.nodes[cid])
      .filter(Boolean);
  }

  /**
   * 获取从根到指定节点的路径。
   *
   * @param {string} id - 目标节点 ID
   * @returns {Object[]} 从根到目标节点的路径数组
   */
  getPath(id) {
    const path = [];
    let currentId = id;

    while (currentId) {
      if (currentId === this.data.root.id) {
        path.unshift(this.data.root);
        break;
      }
      const node = this.data.nodes[currentId];
      if (!node) break;
      path.unshift(node);
      currentId = node.parent_id;
    }

    return path;
  }

  /**
   * 合并两个相似节点。
   *
   * 保留 trigger_count 更高的节点，将另一个节点的 linked_genes 和 linked_skills
   * 合并过来，然后移除被合并的节点。被合并节点的子节点将重新挂载到保留节点下。
   *
   * @param {string} id1 - 第一个节点 ID
   * @param {string} id2 - 第二个节点 ID
   * @returns {Object} 保留的节点
   * @throws {Error} 节点不存在
   */
  mergeNodes(id1, id2) {
    const node1 = this.data.nodes[id1];
    const node2 = this.data.nodes[id2];
    if (!node1) throw new Error(`Node not found: ${id1}`);
    if (!node2) throw new Error(`Node not found: ${id2}`);

    // 保留 trigger_count 更高的节点
    const keeper = node1.trigger_count >= node2.trigger_count ? node1 : node2;
    const merged = node1.trigger_count >= node2.trigger_count ? node2 : node1;

    // 合并 linked_genes
    const geneSet = new Set(keeper.linked_genes || []);
    for (const gene of (merged.linked_genes || [])) {
      geneSet.add(gene);
    }
    keeper.linked_genes = [...geneSet];

    // 合并 linked_skills
    const skillSet = new Set(keeper.linked_skills || []);
    for (const skill of (merged.linked_skills || [])) {
      skillSet.add(skill);
    }
    keeper.linked_skills = [...skillSet];

    // 将被合并节点的子节点重新挂载到保留节点下
    const mergedChildren = Array.isArray(merged.children) ? [...merged.children] : [];
    for (const childId of mergedChildren) {
      const child = this.data.nodes[childId];
      if (child) {
        child.parent_id = keeper.id;
        if (!keeper.children.includes(childId)) {
          keeper.children.push(childId);
        }
      }
    }

    // 从被合并节点的父节点中移除引用
    const mergedParentId = merged.parent_id;
    if (mergedParentId === this.data.root.id) {
      this.data.root.children = this.data.root.children.filter(cid => cid !== merged.id);
    } else if (this.data.nodes[mergedParentId]) {
      this.data.nodes[mergedParentId].children =
        this.data.nodes[mergedParentId].children.filter(cid => cid !== merged.id);
    }

    delete this.data.nodes[merged.id];
    return keeper;
  }

  /**
   * 修剪陈旧节点。
   *
   * 将 last_triggered 距今超过 threshold 天且 v_score 小于 40 的节点标记为 pruned。
   *
   * @param {number} threshold - 天数阈值
   * @returns {string[]} 被修剪的节点 ID 列表
   */
  pruneStale(threshold) {
    const now = Date.now();
    const thresholdMs = threshold * 24 * 60 * 60 * 1000;
    const pruned = [];

    for (const [id, node] of Object.entries(this.data.nodes)) {
      if (node.status === 'pruned') continue;
      if (!node.last_triggered) continue;

      const lastTriggered = new Date(node.last_triggered).getTime();
      const elapsed = now - lastTriggered;

      if (elapsed > thresholdMs && (node.v_score === null || node.v_score < 40)) {
        node.status = 'pruned';
        pruned.push(id);
      }
    }

    return pruned;
  }

  /**
   * 从信号定位最匹配能力路径。
   *
   * 遍历所有节点，检查其 linked_genes 对应的 gene 的 signals_match
   * 是否与给定 signals 有交集，返回匹配度最高节点的路径。
   *
   * @param {string[]} signals - 当前信号集
   * @returns {Object[]} 匹配度最高节点的从根到该节点的路径
   */
  findPath(signals) {
    const signalSet = new Set(signals);
    const genes = loadGenes();
    const geneMap = {};
    for (const gene of genes) {
      geneMap[gene.id] = gene;
    }

    let bestNodeId = null;
    let bestScore = 0;

    for (const [id, node] of Object.entries(this.data.nodes)) {
      if (node.status !== 'active') continue;
      const linkedGenes = node.linked_genes || [];
      if (linkedGenes.length === 0) continue;

      let nodeScore = 0;
      for (const geneId of linkedGenes) {
        const gene = geneMap[geneId];
        if (!gene || !gene.signals_match) continue;
        for (const sig of gene.signals_match) {
          if (signalSet.has(sig)) {
            nodeScore++;
          }
        }
      }

      if (nodeScore > bestScore) {
        bestScore = nodeScore;
        bestNodeId = id;
      }
    }

    if (!bestNodeId) return [];
    return this.getPath(bestNodeId);
  }

  /**
   * 在指定父节点下生长新节点。
   *
   * @param {string} parentId - 父节点 ID
   * @param {Object} candidate - 候选节点参数（传给 createNode）
   * @returns {Object} 新创建的节点
   * @throws {Error} 父节点不存在
   */
  growNode(parentId, candidate) {
    const parent = this.getNode(parentId);
    if (!parent) {
      throw new Error(`Parent node not found: ${parentId}`);
    }

    const node = createNode({
      ...candidate,
      parent_id: parentId,
    });
    this.addNode(node);
    return node;
  }

  /**
   * 获取所有节点（不含根节点）。
   *
   * @returns {Object[]} 所有节点对象数组
   */
  getAllNodes() {
    return Object.values(this.data.nodes);
  }

  /**
   * 获取所有 active 状态的节点。
   *
   * @returns {Object[]} active 状态的节点对象数组
   */
  getActiveNodes() {
    return Object.values(this.data.nodes).filter(n => n.status === 'active');
  }

  /**
   * 序列化能力树为 JSON 对象。
   *
   * @returns {Object} 能力树数据
   */
  toJSON() {
    return {
      root: { ...this.data.root },
      nodes: { ...this.data.nodes },
    };
  }

  /**
   * 持久化能力树到文件。
   */
  save() {
    saveCapabilityTree(this.data);
  }
}

module.exports = { CapabilityTree };
