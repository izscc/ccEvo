'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * OpenClaw 桥接层。
 *
 * 提供与 OpenClaw 目录结构的交互接口，
 * 包括 session logs 读取、全局记忆和用户配置访问。
 */

const DEFAULT_OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');

/**
 * 获取 agent 的 sessions 目录路径。
 *
 * @param {string} agentName - agent 名称
 * @param {string} [openclawDir] - OpenClaw 根目录（默认 ~/.openclaw）
 * @returns {string} sessions 目录完整路径
 */
function getSessionsDir(agentName, openclawDir) {
  const root = openclawDir || DEFAULT_OPENCLAW_DIR;
  return path.join(root, 'agents', agentName, 'sessions');
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
 * 读取指定 agent 的最近 N 个 session log 文件。
 *
 * 读取逻辑：
 * 1. 列出 sessions 目录下的 .jsonl 文件
 * 2. 按修改时间倒序排列
 * 3. 取前 limit 个
 * 4. 读取每个文件解析 JSONL，合并到一个数组
 * 5. 目录不存在则返回空数组
 *
 * @param {string} agentName - agent 名称
 * @param {number} [limit=5] - 读取最近的文件数量
 * @param {string} [openclawDir] - OpenClaw 根目录（默认 ~/.openclaw）
 * @returns {Object[]} 合并的 log 条目
 */
function readRecentSessions(agentName, limit = 5, openclawDir) {
  const sessionsDir = getSessionsDir(agentName, openclawDir);

  if (!fs.existsSync(sessionsDir)) return [];

  let files;
  try {
    files = fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith('.jsonl'));
  } catch {
    return [];
  }

  if (files.length === 0) return [];

  // 按修改时间倒序排列
  const withStats = files.map((f) => {
    const filepath = path.join(sessionsDir, f);
    const stat = fs.statSync(filepath);
    return { file: f, mtime: stat.mtimeMs };
  });
  withStats.sort((a, b) => b.mtime - a.mtime);

  // 取前 limit 个
  const selected = withStats.slice(0, limit);

  // 读取并合并
  const allEntries = [];
  for (const { file } of selected) {
    const filepath = path.join(sessionsDir, file);
    const content = fs.readFileSync(filepath, 'utf-8');
    const entries = parseJSONL(content);
    allEntries.push(...entries);
  }

  return allEntries;
}

/**
 * 读取全局记忆文件 MEMORY.md。
 *
 * @param {string} [openclawDir] - OpenClaw 根目录（默认 ~/.openclaw）
 * @returns {string} MEMORY.md 的内容，文件不存在时返回空字符串
 */
function readMemory(openclawDir) {
  const root = openclawDir || DEFAULT_OPENCLAW_DIR;
  const filepath = path.join(root, 'MEMORY.md');
  if (!fs.existsSync(filepath)) return '';
  return fs.readFileSync(filepath, 'utf-8');
}

/**
 * 读取用户配置 USER.md。
 *
 * @param {string} [openclawDir] - OpenClaw 根目录（默认 ~/.openclaw）
 * @returns {string} USER.md 的内容，文件不存在时返回空字符串
 */
function readUserConfig(openclawDir) {
  const root = openclawDir || DEFAULT_OPENCLAW_DIR;
  const filepath = path.join(root, 'USER.md');
  if (!fs.existsSync(filepath)) return '';
  return fs.readFileSync(filepath, 'utf-8');
}

/**
 * 获取配置的报告工具（从环境变量 EVOLVE_REPORT_TOOL）。
 *
 * @returns {string|null} 报告工具名称，未配置时返回 null
 */
function getReportTool() {
  return process.env.EVOLVE_REPORT_TOOL || null;
}

/**
 * 获取 OpenClaw workspace 目录。
 *
 * 优先读取 openclaw.json 中 agents.defaults.workspace，
 * 回退到 ~/openclaw。
 *
 * @param {string} [openclawDir] - OpenClaw 根目录
 * @returns {string} workspace 目录路径
 */
function getWorkspaceDir(openclawDir) {
  const root = openclawDir || DEFAULT_OPENCLAW_DIR;
  const configPath = path.join(root, 'openclaw.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const ws = config?.agents?.defaults?.workspace;
      if (ws) return ws;
    }
  } catch {
    // 解析失败，使用默认值
  }
  return path.join(os.homedir(), 'openclaw');
}

/**
 * 获取 openclaw-cn CLI 的可执行路径。
 *
 * @returns {string} CLI 路径
 */
function getCliBin() {
  return process.env.OPENCLAW_BIN || 'openclaw-cn';
}

/**
 * 通过 openclaw-cn agent 命令派发子 agent 执行任务。
 *
 * 使用 `openclaw-cn agent --local --message <msg> --json` 模式，
 * 在本地运行一个独立的 agent 轮次来执行指定任务。
 *
 * @param {Object} params - 派发参数
 * @param {string} params.message - 要发送给 agent 的任务描述
 * @param {string} [params.agentId] - 指定 agent ID（默认使用 main）
 * @param {string} [params.sessionId] - 复用已有 session
 * @param {string} [params.thinking] - 思考级别 (off|minimal|low|medium|high)
 * @param {number} [params.timeoutSec=300] - 超时秒数
 * @returns {Promise<{ success: boolean, output: string, error: string|null }>}
 */
async function sessionsSpawn(params) {
  const { execSync } = require('node:child_process');
  const bin = getCliBin();

  const args = ['agent', '--local', '--json'];
  args.push('--message', params.message);

  if (params.agentId) {
    args.push('--agent', params.agentId);
  }
  if (params.sessionId) {
    args.push('--session-id', params.sessionId);
  }
  if (params.thinking) {
    args.push('--thinking', params.thinking);
  }

  const timeoutMs = (params.timeoutSec || 300) * 1000;

  // 构建安全的命令字符串
  const cmd = [bin, ...args.map(a => JSON.stringify(a))].join(' ');

  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    return { success: true, output: output.trim(), error: null };
  } catch (err) {
    return {
      success: false,
      output: err.stdout ? err.stdout.toString().trim() : '',
      error: err.stderr ? err.stderr.toString().trim() : err.message,
    };
  }
}

/**
 * 异步版 sessionsSpawn，使用 child_process.exec。
 *
 * @param {Object} params - 同 sessionsSpawn 参数
 * @returns {Promise<{ success: boolean, output: string, error: string|null }>}
 */
function sessionsSpawnAsync(params) {
  const { exec } = require('node:child_process');
  const bin = getCliBin();

  const args = ['agent', '--local', '--json'];
  args.push('--message', params.message);

  if (params.agentId) args.push('--agent', params.agentId);
  if (params.sessionId) args.push('--session-id', params.sessionId);
  if (params.thinking) args.push('--thinking', params.thinking);

  const timeoutMs = (params.timeoutSec || 300) * 1000;
  const cmd = [bin, ...args.map(a => JSON.stringify(a))].join(' ');

  return new Promise((resolve) => {
    exec(cmd, { encoding: 'utf-8', timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, output: stdout?.trim() || '', error: stderr?.trim() || err.message });
      } else {
        resolve({ success: true, output: stdout?.trim() || '', error: null });
      }
    });
  });
}

module.exports = {
  DEFAULT_OPENCLAW_DIR,
  getSessionsDir,
  readRecentSessions,
  readMemory,
  readUserConfig,
  getReportTool,
  getWorkspaceDir,
  getCliBin,
  sessionsSpawn,
  sessionsSpawnAsync,
};
