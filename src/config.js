'use strict';

const fs = require('node:fs');

const VALID_FORMATS = Object.freeze(['csv', 'xlsx']);

const DEFAULT_SETTINGS = Object.freeze({
  timeoutMs: 15000,
  delayBetweenSourcesMs: 1000,
  // 認証情報を必要としない経路を既定にする。鍵をリポジトリに入れない前提。
  allowAuthenticatedSources: false,
  outputFormats: ['csv', 'xlsx'],
});

function normalizeSettings(rawSettings = {}) {
  if (rawSettings === null || typeof rawSettings !== 'object') {
    throw new Error('settings はオブジェクトである必要があります。');
  }
  return { ...DEFAULT_SETTINGS, ...rawSettings };
}

function validateSource(source, index) {
  if (!source || typeof source !== 'object') {
    throw new Error(`sources[${index}] はオブジェクトである必要があります。`);
  }
  const { name, type, url } = source;
  if (!name) throw new Error(`sources[${index}].name は必須です。`);
  if (!type) throw new Error(`sources[${index}].type は必須です。`);
  if (!url) throw new Error(`sources[${index}].url は必須です。`);
  return {
    name,
    type,
    url,
    category: source.category ?? '',
    region: source.region ?? '',
    authRequired: source.authRequired === true,
  };
}

function validateConfig(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('設定はオブジェクトである必要があります。');

  const settings = normalizeSettings(raw.settings);

  for (const format of settings.outputFormats) {
    if (!VALID_FORMATS.includes(format)) throw new Error(`未対応の出力形式です: ${format}`);
  }

  if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
    throw new Error('sources を1件以上指定してください。');
  }

  const sources = raw.sources.map(validateSource);

  const authSources = sources.filter((source) => source.authRequired);
  if (authSources.length > 0 && !settings.allowAuthenticatedSources) {
    throw new Error(
      `認証が必要なソースは既定で拒否されます（settings.allowAuthenticatedSources を明示的に true にしてください）: ${authSources
        .map((source) => source.name)
        .join(', ')}`,
    );
  }

  return { settings, sources };
}

function loadConfig(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return validateConfig(raw);
}

module.exports = {
  DEFAULT_SETTINGS,
  VALID_FORMATS,
  loadConfig,
  normalizeSettings,
  validateConfig,
  validateSource,
};
