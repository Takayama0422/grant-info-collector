'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collectGrants, collectFromSource } = require('../src/collector');

test('未実装のソース種別は明示的なエラーになる', async () => {
  await assert.rejects(
    () => collectFromSource({ name: 'サンプル', type: 'html', url: 'https://example.com/' }),
    /未実装/,
  );
});

test('collectGrantsはソースごとにonSourceStartを呼び、未実装エラーを伝播する', async () => {
  const config = {
    sources: [
      { name: 'A', type: 'html', url: 'https://example.com/a' },
      { name: 'B', type: 'html', url: 'https://example.com/b' },
    ],
  };
  const started = [];

  await assert.rejects(
    () =>
      collectGrants(config, {
        onSourceStart(source) { started.push(source.name); },
      }),
    /未実装/,
  );

  assert.deepEqual(started, ['A']);
});

test('中断シグナルが立っていれば即座に中断する', async () => {
  const controller = new AbortController();
  controller.abort(new Error('ABORTED_FOR_TEST'));

  await assert.rejects(
    () => collectGrants({ sources: [{ name: 'A', type: 'html', url: 'https://example.com/' }] }, { signal: controller.signal }),
    /ABORTED_FOR_TEST/,
  );
});
