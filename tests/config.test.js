'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, normalizeSettings, DEFAULT_SETTINGS } = require('../src/config');

test('既定のsettingsを補完できる', () => {
  const settings = normalizeSettings();
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test('sourcesが空だと拒否する', () => {
  assert.throws(() => validateConfig({ sources: [] }), /1件以上指定/);
});

test('authRequiredなソースは既定で拒否する', () => {
  assert.throws(
    () =>
      validateConfig({
        sources: [{ name: 'A', type: 'html', url: 'https://example.com/', authRequired: true }],
      }),
    /既定で拒否/,
  );
});

test('allowAuthenticatedSourcesがtrueなら許可する', () => {
  const config = validateConfig({
    settings: { allowAuthenticatedSources: true },
    sources: [{ name: 'A', type: 'html', url: 'https://example.com/', authRequired: true }],
  });
  assert.equal(config.sources[0].authRequired, true);
});

test('未対応の出力形式は拒否する', () => {
  assert.throws(
    () =>
      validateConfig({
        settings: { outputFormats: ['pdf'] },
        sources: [{ name: 'A', type: 'html', url: 'https://example.com/' }],
      }),
    /未対応の出力形式/,
  );
});

test('有効な設定を正規化できる', () => {
  const config = validateConfig({
    sources: [{ name: 'サンプル', type: 'html', url: 'https://example.com/grants' }],
  });
  assert.equal(config.sources[0].category, '');
  assert.equal(config.sources[0].region, '');
  assert.equal(config.sources[0].authRequired, false);
  assert.deepEqual(config.settings.outputFormats, ['csv', 'xlsx']);
});
