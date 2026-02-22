#!/usr/bin/env node
'use strict';

/**
 * ccEvo CLI 入口。
 *
 * 命令：
 *   run          执行一轮进化周期
 *   solidify     执行固化验证
 *   pcec         启动 PCEC 周期
 *   tree         查看能力树
 *   report       生成进化报告
 */

const command = process.argv[2];
const flags = process.argv.slice(3);

function parseFlags(args) {
  const opts = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      opts[key] = value === undefined ? true : value;
    }
  }
  return opts;
}

async function main() {
  const opts = parseFlags(flags);

  switch (command) {
    case 'run': {
      const { EvolutionEngine } = require('./src/core/engine');
      const engine = new EvolutionEngine({
        strategy: opts.strategy || null,
        agentName: opts.agent || null,
        sessionsDir: opts.sessions || null,
        cwd: opts.cwd || process.cwd(),
        dryRun: !!opts['dry-run'],
        verbose: true,
      });

      console.log('=== ccEvo: Starting evolution cycle ===');
      const result = await engine.runCycle();

      if (result.skipped) {
        console.log(`Cycle skipped: ${result.reason}`);
      } else {
        console.log(`Cycle ${result.cycle} completed.`);
        console.log(`  Gene: ${result.gene?.id || 'none'}`);
        console.log(`  Mutation: ${result.mutation?.category || 'none'}`);
        console.log(`  Solidify: ${result.solidifyResult?.success ? 'SUCCESS' : 'FAILED'}`);
      }

      console.log('\n=== Engine Status ===');
      const status = engine.getStatus();
      console.log(`  Genes: ${status.genesCount}`);
      console.log(`  Capsules: ${status.capsulesCount}`);
      console.log(`  Events: ${status.eventsCount}`);
      break;
    }

    case 'solidify': {
      const { solidify, computeBlast, runValidations } = require('./src/core/solidify');
      const { loadGenes } = require('./src/gep/store');
      const dryRun = !!opts['dry-run'];

      console.log(`=== ccEvo: Solidify${dryRun ? ' (dry-run)' : ''} ===`);
      const genes = loadGenes();
      if (genes.length === 0) {
        console.log('No genes to solidify.');
        break;
      }

      for (const gene of genes) {
        if (gene.validation && gene.validation.length > 0) {
          console.log(`\nValidating gene: ${gene.id}`);
          const vResult = runValidations(gene.validation, opts.cwd || process.cwd());
          for (const r of vResult.results) {
            console.log(`  [${r.success ? 'PASS' : 'FAIL'}] ${r.command}`);
            if (!r.success) console.log(`    ${r.output}`);
          }
        }
      }
      break;
    }

    case 'pcec': {
      const { PCECCycle, needsForceBreakthrough } = require('./src/pcec/cycle');
      const { generateExplosion } = require('./src/pcec/explosion');
      const { PCECScheduler } = require('./src/pcec/scheduler');

      const once = !!opts.once;

      if (once) {
        console.log('=== ccEvo: PCEC Single Cycle ===');
        const cycle = new PCECCycle();

        // 生成思维爆炸
        const explosion = generateExplosion({
          currentCapabilities: [],
          recentFailures: [],
          stagnantCycles: needsForceBreakthrough() ? 2 : 0,
        });
        console.log(`\nFocus: ${explosion.focusArea}`);
        console.log('Questions:');
        for (const q of explosion.questions) {
          console.log(`  - ${q}`);
        }

        // 模拟产出
        cycle.addOutcome({
          type: 'abstraction',
          description: 'PCEC cycle initiated, awaiting agent processing',
        });

        const summary = cycle.complete();
        console.log(`\nCycle ${cycle.id}: ${cycle.status}`);
        console.log(`Substantive: ${summary.substantive}`);
      } else {
        console.log('=== ccEvo: PCEC Scheduler ===');
        console.log('Starting scheduler (Ctrl+C to stop)...');
        const scheduler = new PCECScheduler({
          onCycle: async () => {
            const cycle = new PCECCycle();
            console.log(`\n[${new Date().toISOString()}] PCEC cycle ${cycle.id} started`);
            cycle.addOutcome({
              type: 'abstraction',
              description: 'Scheduled cycle, awaiting agent processing',
            });
            const summary = cycle.complete();
            console.log(`Cycle completed. Substantive: ${summary.substantive}`);
          },
        });
        scheduler.start();
      }
      break;
    }

    case 'tree': {
      const { CapabilityTree } = require('./src/tree/capability_tree');
      const tree = new CapabilityTree();
      const nodes = tree.getAllNodes();

      console.log('=== ccEvo: Capability Tree ===');
      console.log(`Total nodes: ${nodes.length}`);

      if (nodes.length === 0) {
        console.log('\n(Empty tree. Run evolution cycles to grow capabilities.)');
      } else {
        const active = nodes.filter(n => n.status === 'active');
        const pruned = nodes.filter(n => n.status === 'pruned');
        const candidate = nodes.filter(n => n.status === 'candidate');

        console.log(`  Active: ${active.length}`);
        console.log(`  Candidate: ${candidate.length}`);
        console.log(`  Pruned: ${pruned.length}`);

        console.log('\nTree:');
        for (const node of active) {
          const depth = node.id.split('.').length - 1;
          const indent = '  '.repeat(depth);
          const vscore = node.v_score !== null ? ` [V:${node.v_score}]` : '';
          console.log(`${indent}${node.id}: ${node.name} (${node.level})${vscore}`);
        }
      }
      break;
    }

    case 'report': {
      const report = require('./scripts/report');
      report.generateReport();
      break;
    }

    default: {
      console.log('ccEvo - 能力驱动的自我进化引擎\n');
      console.log('Usage: node index.js <command> [options]\n');
      console.log('Commands:');
      console.log('  run          Execute one evolution cycle');
      console.log('  solidify     Run solidification validation');
      console.log('  pcec         Start PCEC cycle');
      console.log('  tree         View capability tree');
      console.log('  report       Generate evolution report');
      console.log('\nOptions:');
      console.log('  --dry-run    Dry run mode (no actual changes)');
      console.log('  --strategy=  Force strategy (balanced/innovate/harden/repair-only)');
      console.log('  --agent=     OpenClaw agent name');
      console.log('  --sessions=  Custom sessions directory');
      console.log('  --once       PCEC: run single cycle');
      console.log('  --verbose    Verbose output');
      break;
    }
  }
}

main().catch(err => {
  console.error('[ccEvo] Fatal error:', err.message);
  process.exit(1);
});
