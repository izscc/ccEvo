'use strict';

/**
 * 系统健康检查。
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadGenes, loadCapsules, loadEvents, assetPath } = require('../src/gep/store');

/**
 * 执行健康检查。
 *
 * @returns {{ healthy: boolean, checks: Array<{ name: string, ok: boolean, message: string }> }}
 */
function runHealthCheck() {
  const checks = [];

  // 1. 资产目录存在
  const assetsDir = path.join(__dirname, '..', 'assets');
  checks.push({
    name: 'assets_directory',
    ok: fs.existsSync(assetsDir),
    message: fs.existsSync(assetsDir) ? 'Assets directory exists' : 'Assets directory missing',
  });

  // 2. 核心文件可读
  const coreFiles = ['genes.json', 'capsules.json', 'events.jsonl', 'capability_tree.json'];
  for (const f of coreFiles) {
    const filepath = assetPath(f);
    const exists = fs.existsSync(filepath);
    checks.push({
      name: `file_${f}`,
      ok: exists,
      message: exists ? `${f} readable` : `${f} missing`,
    });
  }

  // 3. JSON 文件可解析
  try {
    const genes = loadGenes();
    checks.push({
      name: 'genes_valid',
      ok: Array.isArray(genes),
      message: `genes.json: ${genes.length} entries`,
    });
  } catch (err) {
    checks.push({ name: 'genes_valid', ok: false, message: `genes.json parse error: ${err.message}` });
  }

  try {
    const capsules = loadCapsules();
    checks.push({
      name: 'capsules_valid',
      ok: Array.isArray(capsules),
      message: `capsules.json: ${capsules.length} entries`,
    });
  } catch (err) {
    checks.push({ name: 'capsules_valid', ok: false, message: `capsules.json parse error: ${err.message}` });
  }

  try {
    const events = loadEvents();
    checks.push({
      name: 'events_valid',
      ok: Array.isArray(events),
      message: `events.jsonl: ${events.length} entries`,
    });
  } catch (err) {
    checks.push({ name: 'events_valid', ok: false, message: `events.jsonl parse error: ${err.message}` });
  }

  // 4. Gene 结构完整性
  try {
    const { validateGene } = require('../src/gep/gene');
    const genes = loadGenes();
    let invalidCount = 0;
    for (const g of genes) {
      const v = validateGene(g);
      if (!v.valid) invalidCount++;
    }
    checks.push({
      name: 'gene_integrity',
      ok: invalidCount === 0,
      message: invalidCount === 0 ? 'All genes valid' : `${invalidCount} invalid genes`,
    });
  } catch (err) {
    checks.push({ name: 'gene_integrity', ok: false, message: err.message });
  }

  // 5. 模块可加载
  const modules = [
    ['core/engine', '../src/core/engine'],
    ['core/signals', '../src/core/signals'],
    ['core/selector', '../src/core/selector'],
    ['core/solidify', '../src/core/solidify'],
    ['gep/gene', '../src/gep/gene'],
    ['gep/capsule', '../src/gep/capsule'],
    ['gep/event', '../src/gep/event'],
    ['gep/mutation', '../src/gep/mutation'],
    ['gep/store', '../src/gep/store'],
    ['tree/capability_tree', '../src/tree/capability_tree'],
    ['vfm/scorer', '../src/vfm/scorer'],
    ['adl/lock', '../src/adl/lock'],
    ['pcec/cycle', '../src/pcec/cycle'],
    ['strategy', '../src/strategy'],
    ['personality', '../src/personality'],
  ];

  for (const [name, modPath] of modules) {
    try {
      require(modPath);
      checks.push({ name: `module_${name}`, ok: true, message: `${name} loads OK` });
    } catch (err) {
      checks.push({ name: `module_${name}`, ok: false, message: `${name}: ${err.message}` });
    }
  }

  const healthy = checks.every(c => c.ok);
  return { healthy, checks };
}

// CLI 直接执行
if (require.main === module) {
  console.log('=== ccEvo Health Check ===\n');
  const { healthy, checks } = runHealthCheck();

  for (const c of checks) {
    const icon = c.ok ? '✓' : '✗';
    console.log(`  [${icon}] ${c.name}: ${c.message}`);
  }

  console.log(`\nOverall: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  process.exit(healthy ? 0 : 1);
}

module.exports = { runHealthCheck };
