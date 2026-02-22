'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractSignals } = require('../src/core/signals');

describe('signals.extractSignals', () => {
  it('returns empty for empty input', () => {
    assert.deepStrictEqual(extractSignals([]), []);
    assert.deepStrictEqual(extractSignals(null), []);
  });

  it('extracts log_error and errsig from error entries', () => {
    const entries = [
      { level: 'error', detail: 'timeout' },
      { type: 'error', detail: 'parse_fail' },
    ];
    const signals = extractSignals(entries);
    assert.ok(signals.includes('log_error'));
    assert.ok(signals.includes('errsig:timeout'));
    assert.ok(signals.includes('errsig:parse_fail'));
  });

  it('extracts recurring_error when same detail appears 3+ times', () => {
    const entries = [
      { level: 'error', detail: 'oom' },
      { level: 'error', detail: 'oom' },
      { level: 'error', detail: 'oom' },
    ];
    const signals = extractSignals(entries);
    assert.ok(signals.includes('recurring_error'));
  });

  it('does not flag recurring_error for fewer than 3', () => {
    const entries = [
      { level: 'error', detail: 'oom' },
      { level: 'error', detail: 'oom' },
    ];
    const signals = extractSignals(entries);
    assert.ok(!signals.includes('recurring_error'));
  });

  it('extracts user_feature_request', () => {
    const entries = [
      { type: 'user_request', message: 'please add a new feature for search' },
    ];
    const signals = extractSignals(entries);
    assert.ok(signals.includes('user_feature_request'));
  });

  it('extracts stable_success_plateau when last 10 are success', () => {
    const entries = Array.from({ length: 10 }, () => ({ status: 'success' }));
    const signals = extractSignals(entries);
    assert.ok(signals.includes('stable_success_plateau'));
  });

  it('extracts high_tool_usage for tool used 5+ times', () => {
    const entries = Array.from({ length: 5 }, () => ({ tool_name: 'Read' }));
    const signals = extractSignals(entries);
    assert.ok(signals.includes('high_tool_usage:Read'));
  });

  it('extracts repeated_tool_usage for 3+ adjacent same tool', () => {
    const entries = [
      { tool_name: 'Bash' },
      { tool_name: 'Bash' },
      { tool_name: 'Bash' },
    ];
    const signals = extractSignals(entries);
    assert.ok(signals.includes('repeated_tool_usage:Bash'));
  });

  it('extracts capability_candidate from capability_mention entries', () => {
    const entries = [
      { type: 'capability_mention', name: 'auto_deploy' },
    ];
    const signals = extractSignals(entries);
    assert.ok(signals.includes('capability_candidate:auto_deploy'));
  });

  it('returns deduplicated signals', () => {
    const entries = [
      { level: 'error', detail: 'x' },
      { level: 'error', detail: 'x' },
    ];
    const signals = extractSignals(entries);
    const errorCount = signals.filter(s => s === 'log_error').length;
    assert.strictEqual(errorCount, 1);
  });
});
