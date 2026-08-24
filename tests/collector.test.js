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

test('固定データだけで（ネットワーク無しで）収集を最後まで通せる', async () => {
  const { loadConfig } = require('../src/config');
  const { createOfflineFetcher } = require('../src/http');
  const config = loadConfig(require('node:path').join(__dirname, '..', 'config', 'sources.json'));
  const fetcher = createOfflineFetcher();

  const records = await collectGrants(config, { fetcher, collectedAt: '2026-08-25T00:00:00.000Z' });

  assert.ok(records.length > 50, `収集件数が少なすぎます: ${records.length}`);
  for (const record of records) {
    assert.ok(record.title.length > 0);
    assert.ok(record.organization.length > 0);
    assert.match(record.url, /^https:\/\/data\.e-gov\.go\.jp\/data\/dataset\//);
    assert.equal(record.collected_at, '2026-08-25T00:00:00.000Z');
  }
});

test('同じデータセットは1件にまとめ、分類を結合する', () => {
  const { dedupeRecords } = require('../src/collector');
  const merged = dedupeRecords([
    { url: 'https://example.com/a', category: '補助金', source: 'A' },
    { url: 'https://example.com/a', category: '助成金', source: 'B' },
    { url: 'https://example.com/b', category: '公募', source: 'C' },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].category, '補助金 / 助成金');
  assert.equal(merged[0].source, 'A / B');
});

test('robots.txt が拒否している経路は取得しない', async () => {
  const { collectEgovCatalog } = require('../src/collector');
  const fetcher = {
    offline: true,
    userAgent: 'grant-info-collector/1.0',
    throttle: { setMinInterval() {}, async wait() {} },
    async fetch(url) {
      if (url.endsWith('/robots.txt')) {
        return { status: 200, text: 'User-agent: *\nDisallow: /\nCrawl-Delay: 1', url };
      }
      throw new Error(`取得してはいけないURLに接続しました: ${url}`);
    },
  };

  await assert.rejects(
    () =>
      collectEgovCatalog(
        { name: 'テスト', type: 'egov-catalog', url: 'https://data.e-gov.go.jp/data/dataset', query: '補助金', maxOrganizations: 1, maxPages: 1 },
        { fetcher, collectedAt: '2026-08-25T00:00:00.000Z' },
      ),
    /robots.txt が拒否している経路/,
  );
});
