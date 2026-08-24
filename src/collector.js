'use strict';

const { buildPolicy } = require('./robots');
const { createFetcher } = require('./http');
const egov = require('./egov');

/**
 * GrantRecord（収集結果1件）の形。src/csv.js・src/xlsx.js の出力列と一致させる。
 *
 * @typedef {Object} GrantRecord
 * @property {string} collected_at        収集日時（ISO 8601）
 * @property {string} title               公募名
 * @property {string} organization        実施主体（省庁・自治体・団体名）
 * @property {string} category            分類（例: 補助金 / 助成金）
 * @property {string} region              対象地域
 * @property {string} amount              金額・上限額（テキストのまま保持。数値化は行わない）
 * @property {string} application_start   受付開始日
 * @property {string} application_deadline 受付締切日
 * @property {string} url                 詳細ページURL
 * @property {string} source              情報源名（config.sources[].name）
 * @property {string} status              取得状態（例: ok / error）
 * @property {string} summary             概要（出典側の説明文）
 * @property {string} data_formats        公開されているデータ形式
 * @property {string} updated_at          出典側の更新日
 */

/**
 * 取得先ホストの robots.txt を読み、接続してよい経路と最小間隔を決める。
 * ホスト直下とカタログのマウント位置の両方を読み、厳しい側に従う。
 * 同じ実行の中では1ホストにつき1回だけ取得する（取得器ごとに覚える）。
 */
async function loadPolicy(fetcher, origin) {
  const cache = (fetcher.robotsCache ??= new Map());
  if (cache.has(origin)) return cache.get(origin);

  const documents = [];
  for (const { url, mount } of egov.robotsUrls(origin)) {
    const response = await fetcher.fetch(url);
    documents.push({ text: response.status === 200 ? response.text : null, mount });
  }
  const policy = buildPolicy(documents, fetcher.userAgent);
  cache.set(origin, policy);
  return policy;
}

function assertAllowed(policy, url) {
  const { pathname, search } = new URL(url);
  if (!policy.isAllowed(pathname)) {
    throw new Error(`robots.txt が拒否している経路のため取得しません: ${pathname}${search}`);
  }
}

async function fetchSearchPage(fetcher, policy, url) {
  assertAllowed(policy, url);
  const response = await fetcher.fetch(url);
  if (response.status !== 200) throw new Error(`検索ページの取得に失敗しました（HTTP ${response.status}）: ${url}`);
  return egov.parseSearchPage(response.text);
}

/**
 * e-Govデータポータルのカタログから、キーワードに一致するデータセットを収集する。
 *
 * 実施主体（府省）は検索結果の一覧に載らないため、
 * 1) キーワードだけで検索して「組織」の絞り込み候補を読み取り
 * 2) 件数の多い組織から順に、組織で絞り込んだ検索を行う
 * という2段構えにして、各行の実施主体を確定させる。
 */
async function collectEgovCatalog(source, options = {}) {
  const { fetcher, collectedAt, onProgress } = options;
  const origin = new URL(source.url).origin;
  const policy = await loadPolicy(fetcher, origin);
  fetcher.throttle.setMinInterval(policy.crawlDelayMs);

  const indexUrl = egov.buildSearchUrl({ query: source.query, origin, searchPath: new URL(source.url).pathname });
  const index = await fetchSearchPage(fetcher, policy, indexUrl);
  onProgress?.({ kind: 'index', source: source.name, total: index.total, organizations: index.organizations.length });

  const targets = index.organizations
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, source.maxOrganizations);

  const records = [];
  for (const organization of targets) {
    const pages = Math.max(1, Math.min(source.maxPages, Math.ceil(organization.count / egov.PAGE_SIZE)));
    for (let page = 1; page <= pages; page += 1) {
      const url = egov.buildSearchUrl({
        query: source.query,
        organization: organization.id,
        page,
        origin,
        searchPath: new URL(source.url).pathname,
      });
      const result = await fetchSearchPage(fetcher, policy, url);
      for (const item of result.items) {
        records.push(egov.toRecord(item, { source, organizationName: organization.name, collectedAt, origin }));
      }
      onProgress?.({ kind: 'page', source: source.name, organization: organization.name, page, count: result.items.length });
    }
  }
  return records;
}

const ADAPTERS = { 'egov-catalog': collectEgovCatalog };

/**
 * ソース種別ごとの収集アダプタを解決する。
 *
 * @param {{name: string, type: string, url: string}} source
 * @returns {Promise<GrantRecord[]>}
 */
async function collectFromSource(source, options = {}) {
  const adapter = ADAPTERS[source.type];
  if (!adapter) {
    throw new Error(`未実装: ソース種別 "${source.type}" (${source.name}) の収集ロジックは未実装です。`);
  }
  return adapter(source, options);
}

/**
 * 同じデータセットが複数のキーワードに一致した場合、URLで1件にまとめて分類を結合する。
 */
function dedupeRecords(records) {
  const byUrl = new Map();
  for (const record of records) {
    const existing = byUrl.get(record.url);
    if (!existing) { byUrl.set(record.url, { ...record }); continue; }
    const categories = new Set([...existing.category.split(' / '), record.category].filter(Boolean));
    existing.category = [...categories].join(' / ');
    const sources = new Set([...existing.source.split(' / '), record.source].filter(Boolean));
    existing.source = [...sources].join(' / ');
  }
  return [...byUrl.values()];
}

/**
 * 設定内の全ソースを順に収集する。並列取得は行わない。
 *
 * @param {{settings: object, sources: Array<object>}} config
 * @param {{signal?: AbortSignal, fetcher?: object, collectedAt?: string, onSourceStart?: Function, onProgress?: Function}} [options]
 * @returns {Promise<GrantRecord[]>}
 */
async function collectGrants(config, options = {}) {
  const { signal, onSourceStart, onProgress } = options;
  const settings = config.settings ?? {};
  const fetcher = options.fetcher ?? createFetcher({
    offline: Boolean(options.offline),
    timeoutMs: settings.timeoutMs,
  });
  if (!options.fetcher) fetcher.throttle.setMinInterval(settings.delayBetweenSourcesMs ?? 0);
  const collectedAt = options.collectedAt ?? new Date().toISOString();

  const records = [];
  const total = config.sources.length;

  for (let index = 0; index < total; index += 1) {
    if (signal?.aborted) throw signal.reason ?? new Error('ABORTED');
    const source = config.sources[index];
    onSourceStart?.(source, index, total);
    const sourceRecords = await collectFromSource(source, { fetcher, collectedAt, onProgress, signal });
    records.push(...sourceRecords);
  }

  return records;
}

module.exports = { collectEgovCatalog, collectFromSource, collectGrants, dedupeRecords, loadPolicy };
