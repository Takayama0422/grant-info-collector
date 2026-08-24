'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maskSecrets, safeError } = require('../src/redaction');

test('Authorizationヘッダーの値をマスクする', () => {
  assert.equal(maskSecrets('Authorization: secret-value-123'), 'Authorization: [REDACTED]');
});

test('Bearerトークンをマスクする', () => {
  assert.equal(maskSecrets('failed with Bearer abc.def.ghi'), 'failed with Bearer [REDACTED]');
});

test('api_keyやtokenのクエリパラメータをマスクする', () => {
  assert.equal(maskSecrets('GET /x?api_key=abcd1234'), 'GET /x?api_key=[REDACTED]');
  assert.equal(maskSecrets('token: xyz987'), 'token: [REDACTED]');
});

test('通常のエラーメッセージはそのまま', () => {
  assert.equal(maskSecrets('ファイルが見つかりません'), 'ファイルが見つかりません');
});

test('safeErrorはErrorインスタンスからメッセージを取り出す', () => {
  assert.equal(safeError(new Error('token=zzz')), 'token=[REDACTED]');
  assert.equal(safeError('plain string'), 'plain string');
});
