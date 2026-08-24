'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArguments, resolveOutputDirectory, timestampFolder } = require('../src/cli');

test('--offline と --timestamp を受け付ける', () => {
  const parsed = parseArguments(['--config', 'config/sources.json', '--offline', '--timestamp']);
  assert.equal(parsed.offline, true);
  assert.equal(parsed.timestamp, true);
});

test('--timestamp を付けると出力先に日時フォルダを足す', () => {
  const date = new Date(2026, 7, 25, 1, 2, 3);
  assert.equal(timestampFolder(date), '20260825-010203');
  assert.equal(
    resolveOutputDirectory({ output: 'reports/runs', timestamp: true }, date),
    'reports/runs/20260825-010203',
  );
  assert.equal(resolveOutputDirectory({ output: 'reports/latest', timestamp: false }, date), 'reports/latest');
});
