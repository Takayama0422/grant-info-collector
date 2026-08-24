'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeCsv, rowsToCsv, sanitizeCsvCell } = require('../src/csv');

test('引用符・改行・日本語を安全に出力する', () => {
  assert.equal(escapeCsv('a"b'), '"a""b"');

  const csv = rowsToCsv([
    {
      collected_at: '2026-08-25T00:00:00.000Z',
      title: '日本語,公募名',
      organization: '1行目\n2行目',
    },
  ]);

  assert.equal(csv.startsWith('﻿'), true);
  assert.match(csv, /"日本語,公募名"/);
  assert.match(csv, /"1行目\n2行目"/);
});

test('数式インジェクションになりうる先頭文字をエスケープする', () => {
  assert.equal(sanitizeCsvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(sanitizeCsvCell('+1'), "'+1");
  assert.equal(sanitizeCsvCell('-1'), "'-1");
  assert.equal(sanitizeCsvCell('@cmd'), "'@cmd");
  assert.equal(sanitizeCsvCell('通常の文字列'), '通常の文字列');
});

test('欠損値は空文字として扱う', () => {
  assert.equal(sanitizeCsvCell(null), '');
  assert.equal(sanitizeCsvCell(undefined), '');
});
