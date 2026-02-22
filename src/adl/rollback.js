'use strict';

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

/**
 * ADL 回滚机制。
 *
 * 提供进化前快照创建和进化失败后的回滚能力。
 * 保护关键路径不被误删。
 */

/** 保护路径，回滚时不删除 */
const PROTECTED_PATHS = ['package.json', 'SKILL.md', 'assets/', '.git/', 'node_modules/'];

/**
 * 检查文件是否在保护路径下。
 *
 * @param {string} filePath - 待检查的文件路径（相对路径）
 * @returns {boolean} 是否受保护
 */
function isProtected(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;

  const normalized = filePath.replace(/\\/g, '/');

  for (const protectedPath of PROTECTED_PATHS) {
    if (protectedPath.endsWith('/')) {
      // 目录保护：文件路径以该目录开头
      if (normalized.startsWith(protectedPath) || normalized.startsWith('./' + protectedPath)) {
        return true;
      }
    } else {
      // 文件保护：精确匹配或以 ./ 开头后匹配
      if (normalized === protectedPath || normalized === './' + protectedPath) {
        return true;
      }
      // 也匹配子路径中的同名文件
      if (normalized.endsWith('/' + protectedPath)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 在进化前创建快照。
 *
 * 尝试使用 `git stash create` 创建一个不影响工作区的临时提交引用。
 * 如果不是 git 仓库或创建失败，返回 null。
 *
 * @param {string} workDir - 工作目录
 * @returns {{ success: boolean, snapshot: string|null, error: string|null }}
 */
function createSnapshot(workDir) {
  try {
    const result = execSync('git stash create', {
      cwd: workDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // git stash create 在没有变更时返回空字符串
    if (!result) {
      return { success: true, snapshot: null, error: null };
    }

    return { success: true, snapshot: result, error: null };
  } catch (err) {
    return { success: false, snapshot: null, error: err.message };
  }
}

/**
 * 执行回滚。
 *
 * 对 changedFiles 尝试 git checkout 恢复；
 * 对 newFiles 在非保护路径下直接删除。
 * 所有操作均有 try-catch 保护，不会因单个文件失败而中断。
 *
 * @param {string} workDir - 工作目录
 * @param {string[]} changedFiles - 变更的文件列表（相对路径）
 * @param {string[]} newFiles - 新增的文件列表（相对路径）
 * @returns {{ success: boolean, restored: string[], deleted: string[], error: string|null }}
 */
function rollback(workDir, changedFiles, newFiles) {
  const restored = [];
  const deleted = [];
  const errors = [];

  // 恢复变更的文件
  if (Array.isArray(changedFiles)) {
    for (const file of changedFiles) {
      try {
        execSync(`git checkout -- ${JSON.stringify(file)}`, {
          cwd: workDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        restored.push(file);
      } catch (err) {
        errors.push(`restore ${file}: ${err.message}`);
      }
    }
  }

  // 删除新增的文件
  if (Array.isArray(newFiles)) {
    for (const file of newFiles) {
      if (isProtected(file)) {
        errors.push(`skip protected: ${file}`);
        continue;
      }

      try {
        const fullPath = path.resolve(workDir, file);
        fs.unlinkSync(fullPath);
        deleted.push(file);
      } catch (err) {
        errors.push(`delete ${file}: ${err.message}`);
      }
    }
  }

  const hasErrors = errors.length > 0;
  return {
    success: !hasErrors,
    restored,
    deleted,
    error: hasErrors ? errors.join('; ') : null,
  };
}

module.exports = { PROTECTED_PATHS, createSnapshot, rollback, isProtected };
