'use strict';

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
 */

/**
 * ソース種別ごとの収集アダプタを解決する。
 * 実装は別タスクで行う。ここではインターフェースのみを固定する。
 *
 * @param {{name: string, type: string, url: string}} source
 * @returns {Promise<GrantRecord[]>}
 */
async function collectFromSource(source) {
  throw new Error(`未実装: ソース種別 "${source.type}" (${source.name}) の収集ロジックは未実装です。`);
}

/**
 * 設定内の全ソースを順に収集する。
 *
 * @param {{sources: Array<{name: string, type: string, url: string}>}} config
 * @param {{signal?: AbortSignal, onSourceStart?: (source: object, index: number, total: number) => void}} [options]
 * @returns {Promise<GrantRecord[]>}
 */
async function collectGrants(config, options = {}) {
  const { signal, onSourceStart } = options;
  const records = [];
  const total = config.sources.length;

  for (let index = 0; index < total; index += 1) {
    if (signal?.aborted) throw signal.reason ?? new Error('ABORTED');
    const source = config.sources[index];
    onSourceStart?.(source, index, total);
    const sourceRecords = await collectFromSource(source);
    records.push(...sourceRecords);
  }

  return records;
}

module.exports = { collectFromSource, collectGrants };
