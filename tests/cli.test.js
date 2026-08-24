'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArguments, resolveFormats } = require('../src/cli');

test('--configが無いとエラーになる', () => {
  assert.throws(() => parseArguments([]), /--config を指定/);
});

test('既定のoutputはreports\/latest', () => {
  const parsed = parseArguments(['--config', 'config/sources.json']);
  assert.equal(parsed.output, 'reports/latest');
});

test('不明なオプションは拒否する', () => {
  assert.throws(() => parseArguments(['--unknown']), /不明なオプション/);
});

test('--helpは他の必須チェックより優先する', () => {
  const parsed = parseArguments(['--help']);
  assert.equal(parsed.help, true);
});

test('resolveFormatsは--formatをカンマ区切りで解釈する', () => {
  const formats = resolveFormats({ format: 'csv, xlsx' }, { settings: { outputFormats: ['csv', 'xlsx'] } });
  assert.deepEqual(formats, ['csv', 'xlsx']);
});

test('resolveFormatsは--format未指定なら設定値を使う', () => {
  const formats = resolveFormats({ format: '' }, { settings: { outputFormats: ['csv'] } });
  assert.deepEqual(formats, ['csv']);
});
