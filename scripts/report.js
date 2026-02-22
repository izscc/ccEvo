'use strict';

/**
 * 进化报告生成。
 */

const { loadGenes, loadCapsules, loadEvents } = require('../src/gep/store');
const { summarizeEvents } = require('../src/gep/event');
const { analyzeTrend } = require('../src/gep/capsule');

/**
 * 生成并输出进化报告。
 */
function generateReport() {
  const genes = loadGenes();
  const capsules = loadCapsules();
  const events = loadEvents();

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║         ccEvo Evolution Report               ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Generated: ${new Date().toISOString()}`);
  console.log();

  // Gene 库统计
  console.log('--- Gene Library ---');
  console.log(`  Total genes: ${genes.length}`);
  const byCategory = { repair: 0, optimize: 0, innovate: 0 };
  for (const g of genes) {
    byCategory[g.category] = (byCategory[g.category] || 0) + 1;
  }
  console.log(`  Repair: ${byCategory.repair}  Optimize: ${byCategory.optimize}  Innovate: ${byCategory.innovate}`);
  console.log();

  // Capsule 统计
  console.log('--- Capsule History ---');
  console.log(`  Total capsules: ${capsules.length}`);
  const trend = analyzeTrend(capsules);
  console.log(`  Trend: ${trend.trend}  Success rate: ${(trend.success_rate * 100).toFixed(1)}%`);
  console.log();

  // 事件统计
  console.log('--- Events ---');
  console.log(`  Total events: ${events.length}`);
  const summary = summarizeEvents(events);
  for (const [type, count] of Object.entries(summary)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log();

  // 最近活动
  if (events.length > 0) {
    console.log('--- Recent Activity (last 10) ---');
    const recent = events.slice(-10);
    for (const e of recent) {
      const time = e.timestamp ? e.timestamp.slice(0, 19) : 'unknown';
      console.log(`  [${time}] ${e.event_type}${e.gene_id ? ` (${e.gene_id})` : ''}`);
    }
    console.log();
  }

  // 健康指标
  console.log('--- Health ---');
  const failCount = events.filter(e => e.event_type === 'solidify_failed').length;
  const successCount = events.filter(e => e.event_type === 'solidify_success').length;
  const totalSolidify = failCount + successCount;
  if (totalSolidify > 0) {
    const rate = (successCount / totalSolidify * 100).toFixed(1);
    console.log(`  Solidify success rate: ${rate}% (${successCount}/${totalSolidify})`);
  } else {
    console.log('  No solidify attempts yet.');
  }

  const adlViolations = events.filter(e => e.event_type === 'adl_violation').length;
  console.log(`  ADL violations: ${adlViolations}`);

  const rollbacks = events.filter(e => e.event_type === 'rollback').length;
  console.log(`  Rollbacks: ${rollbacks}`);
  console.log();
}

module.exports = { generateReport };
