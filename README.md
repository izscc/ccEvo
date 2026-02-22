# ccEvo — 能力驱动的自我进化引擎

<p align="center">
  <strong>让 OpenClaw 智能体持续自我精进的进化框架</strong>
</p>

<p align="center">
  <a href="#安装">安装</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#核心概念">核心概念</a> •
  <a href="#命令参考">命令参考</a> •
  <a href="#架构">架构</a>
</p>

---

## 这是什么？

ccEvo 是一个为 [OpenClaw](https://github.com/anthropics/claude-code) 设计的 **Skill 插件**，为智能体提供系统化的自我进化能力。

它解决的核心问题：智能体在长期使用中积累了大量临时解决方案和重复劳动，但缺乏一套机制将这些经验自动沉淀为可复用能力。

ccEvo 通过 5 个核心模块实现这一目标：

| 模块 | 职责 |
|------|------|
| **GEP 协议** | Gene（变异基因）/ Capsule（成功经验胶囊）/ Event（进化事件审计） |
| **能力树** | 层级化能力图谱，支持生长、修剪、合并 |
| **VFM 价值函数** | V-Score 量化评估每个能力是否值得进化 |
| **ADL 反进化锁** | 强制约束：稳定性 > 可解释性 > 可复用性 > 扩展性 > 新颖性 |
| **PCEC 周期** | 定时认知扩展，强制突破进化停滞 |

## 环境要求

- **Node.js** >= 18.0.0
- **OpenClaw (openclaw-cn)** — 已安装并配置
- **Git** — 用于变更快照与回滚

## 安装

### 一句话安装（推荐）

将以下指令直接发送给你的 OpenClaw，它会自动完成安装、验证和首次进化：

```
安装 ccEvo 自我进化引擎：克隆 https://github.com/izscc/ccEvo.git 到 ~/openclaw/skills/ccEvo 目录（如果该目录已存在则先删除旧版再重新克隆），然后进入该目录运行 node scripts/health.js 确认全部检查通过，最后运行 node index.js run --dry-run 执行一次干跑验证进化引擎工作正常。全部完成后告诉我安装结果。
```

粘贴后 OpenClaw 会自主执行以下流程：
1. `git clone` 拉取代码到 skills 目录
2. `node scripts/health.js` 运行 24 项健康检查
3. `node index.js run --dry-run` 干跑一轮完整进化周期
4. 汇报安装结果

### 手动安装

```bash
# 克隆到 OpenClaw skills 目录
git clone https://github.com/izscc/ccEvo.git ~/openclaw/skills/ccEvo
```

### 符号链接（开发模式）

```bash
git clone https://github.com/izscc/ccEvo.git ~/projects/ccEvo
ln -s ~/projects/ccEvo ~/openclaw/skills/ccEvo
```

## 快速开始

```bash
cd ~/openclaw/skills/ccEvo

# 1. 查看健康状态
node scripts/health.js

# 2. 执行一轮进化周期
node index.js run

# 3. 查看能力树
node index.js tree

# 4. 生成进化报告
node index.js report

# 5. 运行测试
npm test
```

## 核心概念

### Gene（基因）

Gene 是进化的基本单元，描述一种可执行的变异策略。每个 Gene 包含：

- **signals_match** — 触发该 Gene 的信号模式
- **category** — 变异类型：`repair`（修复）/ `optimize`（优化）/ `innovate`（创新）
- **strategy** — 具体执行步骤
- **constraints** — 约束条件（最大文件数、禁止路径等）
- **validation** — 验证命令

ccEvo 内置 9 个种子 Gene，覆盖错误修复、工具优化、能力创新等场景。

### Signal（信号）

从 OpenClaw session logs 自动提取的进化驱动信号：

```
错误信号：  log_error, errsig:<detail>, recurring_error
机会信号：  user_feature_request, capability_gap, stable_success_plateau
工具信号：  high_tool_usage:<tool>, repeated_tool_usage:<tool>
停滞信号：  evolution_stagnation, repair_loop_detected
能力信号：  capability_candidate:<name>
```

### 进化策略

| 策略 | innovate | optimize | repair | 适用场景 |
|------|----------|----------|--------|----------|
| `balanced` | 50% | 30% | 20% | 日常运行 |
| `innovate` | 80% | 15% | 5% | 系统稳定，快速创新 |
| `harden` | 20% | 40% | 40% | 大改后聚焦稳固 |
| `repair-only` | 0% | 20% | 80% | 紧急修复 |
| `early-stabilize` | 10% | 30% | 60% | 新部署初期 |
| `steady-state` | 40% | 40% | 20% | 长期稳定运行 |

### ADL 反进化锁

每次变异提交前必须通过的 5 项门控检查：

1. **复杂度约束** — innovate 变异不得超过 20 文件
2. **可验证性** — expected_effect 必须清晰可评估
3. **反玄学** — 拒绝模糊语言（"某种程度上"、"从更高维度"等）
4. **稳定性回归** — 新变异不得降低已验证能力的成功率
5. **回滚路径** — 必须关联 Gene ID 以便追溯回滚

### V-Score 价值评估

四维度打分（0-100），低于 40 分不予立项：

- **复用频率**（权重 3x）— 被调用次数
- **失败率降低**（权重 3x）— 提升成功率的贡献
- **用户负担减轻**（权重 2x）— 减少用户手动操作
- **自身成本降低**（权重 2x）— 减少推理 token 消耗

## 命令参考

### `run` — 执行进化周期

```bash
node index.js run [options]

--strategy=<name>    指定策略 (balanced/innovate/harden/repair-only)
--agent=<name>       OpenClaw agent 名称
--sessions=<dir>     自定义 sessions 目录
--dry-run            仅模拟，不实际变更
```

进化周期流程：信号提取 → Gene 匹配选择 → 变异提案 → ADL 门控 → 执行 → 固化验证

### `solidify` — 固化验证

```bash
node index.js solidify [--dry-run]
```

对所有 Gene 的 validation 命令执行验证闭环。

### `pcec` — PCEC 周期

```bash
# 单次执行
node index.js pcec --once

# 持续调度（默认 3h 间隔）
node index.js pcec
```

PCEC 每个周期必须产出至少一项：新能力、新抽象或新杠杆。连续两周期无产出将强制推翻默认行为。

### `tree` — 能力树

```bash
node index.js tree
```

展示当前能力树的结构、节点状态和 V-Score。

### `report` — 进化报告

```bash
node index.js report
```

生成包含 Gene/Capsule/Event 统计和健康指标的进化报告。

## 架构

```
ccEvo/
├── index.js                    # CLI 入口
├── SKILL.md                    # OpenClaw Skill 声明
├── src/
│   ├── core/
│   │   ├── engine.js           # 进化引擎主循环
│   │   ├── signals.js          # 信号提取器
│   │   ├── selector.js         # Gene 选择器
│   │   └── solidify.js         # 固化协议
│   ├── gep/
│   │   ├── gene.js             # Gene 数据结构
│   │   ├── capsule.js          # Capsule 经验胶囊
│   │   ├── event.js            # EvolutionEvent 日志
│   │   ├── mutation.js         # 变异协议
│   │   └── store.js            # 持久化层
│   ├── tree/
│   │   ├── capability_tree.js  # 能力树
│   │   ├── node.js             # 能力节点
│   │   └── pruner.js           # 修剪与合并
│   ├── vfm/
│   │   ├── scorer.js           # V-Score 评分
│   │   └── mutator.js          # 价值函数突变
│   ├── adl/
│   │   ├── lock.js             # 反进化锁
│   │   ├── rollback.js         # 回滚机制
│   │   └── validator.js        # 劣化检测
│   ├── pcec/
│   │   ├── cycle.js            # PCEC 周期管理
│   │   ├── scheduler.js        # 调度器
│   │   └── explosion.js        # 思维爆炸
│   ├── strategy.js             # 进化策略预设
│   ├── personality.js          # 人格状态
│   └── bridge.js               # OpenClaw 桥接层
├── assets/                     # 运行时数据
│   ├── genes.json              # Gene 库（含 9 个种子 Gene）
│   ├── capsules.json           # Capsule 库
│   ├── events.jsonl            # 进化事件日志
│   └── capability_tree.json    # 能力树
└── scripts/
    ├── report.js               # 报告生成
    └── health.js               # 健康检查
```

## 数据文件

运行时数据存储在 `assets/` 目录：

| 文件 | 格式 | 说明 |
|------|------|------|
| `genes.json` | JSON Array | Gene 库，包含所有变异基因定义 |
| `capsules.json` | JSON Array | 成功经验胶囊，记录每次成功固化 |
| `events.jsonl` | JSONL | 进化事件日志，追加写入，可审计 |
| `capability_tree.json` | JSON Object | 能力树持久化 |

## 验证

```bash
# 健康检查（24 项）
node scripts/health.js
```

## 灵感来源

- 张昊阳与 OpenClaw 的进化指令体系（能力驱动进化、PCEC、ADL、能力树、VFM）
- [autogame-17/evolver](https://github.com/autogame-17/evolver) 项目的 GEP 协议工程实现

## License

[MIT](LICENSE)
