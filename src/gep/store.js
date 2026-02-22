'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * 资产持久化层。
 *
 * 管理 genes.json, capsules.json, events.jsonl, capability_tree.json 的读写。
 */

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');

/**
 * 获取资产文件的完整路径。
 *
 * @param {string} filename - 文件名
 * @returns {string} 完整路径
 */
function assetPath(filename) {
  return path.join(ASSETS_DIR, filename);
}

/**
 * 读取 JSON 文件。
 *
 * @param {string} filename - 文件名
 * @returns {Object|Array} 解析后的 JSON
 */
function readJSON(filename) {
  const filepath = assetPath(filename);
  if (!fs.existsSync(filepath)) return filename.endsWith('.json') ? [] : {};
  const raw = fs.readFileSync(filepath, 'utf-8').trim();
  if (!raw) return filename.endsWith('.json') ? [] : {};
  return JSON.parse(raw);
}

/**
 * 写入 JSON 文件。
 *
 * @param {string} filename - 文件名
 * @param {Object|Array} data - 要写入的数据
 */
function writeJSON(filename, data) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.writeFileSync(assetPath(filename), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * 追加一行 JSONL（用于事件日志）。
 *
 * @param {string} filename - 文件名
 * @param {Object} record - 单条记录
 */
function appendJSONL(filename, record) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.appendFileSync(assetPath(filename), JSON.stringify(record) + '\n', 'utf-8');
}

/**
 * 读取 JSONL 文件。
 *
 * @param {string} filename - 文件名
 * @returns {Object[]} 记录数组
 */
function readJSONL(filename) {
  const filepath = assetPath(filename);
  if (!fs.existsSync(filepath)) return [];
  const raw = fs.readFileSync(filepath, 'utf-8').trim();
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

// --- Gene CRUD ---

/**
 * 读取所有 Gene。
 *
 * @returns {Object[]}
 */
function loadGenes() {
  return readJSON('genes.json');
}

/**
 * 保存所有 Gene。
 *
 * @param {Object[]} genes
 */
function saveGenes(genes) {
  writeJSON('genes.json', genes);
}

/**
 * 新增 Gene。
 *
 * @param {Object} gene
 */
function addGene(gene) {
  const genes = loadGenes();
  const existing = genes.findIndex(g => g.id === gene.id);
  if (existing >= 0) {
    genes[existing] = gene;
  } else {
    genes.push(gene);
  }
  saveGenes(genes);
}

/**
 * 按 ID 查找 Gene。
 *
 * @param {string} id
 * @returns {Object|null}
 */
function findGene(id) {
  return loadGenes().find(g => g.id === id) || null;
}

/**
 * 删除 Gene。
 *
 * @param {string} id
 * @returns {boolean} 是否成功删除
 */
function removeGene(id) {
  const genes = loadGenes();
  const filtered = genes.filter(g => g.id !== id);
  if (filtered.length === genes.length) return false;
  saveGenes(filtered);
  return true;
}

// --- Capsule CRUD ---

/**
 * 读取所有 Capsule。
 *
 * @returns {Object[]}
 */
function loadCapsules() {
  return readJSON('capsules.json');
}

/**
 * 保存所有 Capsule。
 *
 * @param {Object[]} capsules
 */
function saveCapsules(capsules) {
  writeJSON('capsules.json', capsules);
}

/**
 * 新增 Capsule。
 *
 * @param {Object} capsule
 */
function addCapsule(capsule) {
  const capsules = loadCapsules();
  capsules.push(capsule);
  saveCapsules(capsules);
}

// --- Event Log ---

/**
 * 读取所有进化事件。
 *
 * @returns {Object[]}
 */
function loadEvents() {
  return readJSONL('events.jsonl');
}

/**
 * 追加进化事件。
 *
 * @param {Object} event
 */
function appendEvent(event) {
  appendJSONL('events.jsonl', event);
}

// --- Capability Tree ---

/**
 * 读取能力树。
 *
 * @returns {Object}
 */
function loadCapabilityTree() {
  return readJSON('capability_tree.json');
}

/**
 * 保存能力树。
 *
 * @param {Object} tree
 */
function saveCapabilityTree(tree) {
  writeJSON('capability_tree.json', tree);
}

module.exports = {
  assetPath,
  readJSON,
  writeJSON,
  appendJSONL,
  readJSONL,
  loadGenes,
  saveGenes,
  addGene,
  findGene,
  removeGene,
  loadCapsules,
  saveCapsules,
  addCapsule,
  loadEvents,
  appendEvent,
  loadCapabilityTree,
  saveCapabilityTree,
};
