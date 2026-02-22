---
name: ccEvo
description: "能力驱动的自我进化引擎。结合 GEP 协议、能力树、价值函数和反进化锁，让 OpenClaw 持续自我精进。"
tags: [meta, evolution, core, self-improvement]
---

# ccEvo - 自我进化引擎

## 命令

- `run` — 执行一轮进化周期（信号提取 → Gene 选择 → 变异 → 固化）
- `solidify [--dry-run]` — 对待固化的变更执行验证闭环
- `pcec [--once]` — 启动 PCEC 周期（定时认知扩展）
- `tree` — 查看当前能力树
- `report` — 生成进化报告

## 核心概念

- **GEP 协议**：Gene（基因）/ Capsule（经验胶囊）/ Event（进化事件）
- **能力树**：层级化能力图谱（low/mid/high），支持生长、修剪、合并
- **VFM 价值函数**：V-Score 评估能力进化价值（0-100）
- **ADL 反进化锁**：稳定性 > 可解释性 > 可复用性 > 扩展性 > 新颖性
- **PCEC 周期**：定时自动进化，强制突破停滞
