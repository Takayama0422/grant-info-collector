'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { safeError } = require('./redaction');

const USER_AGENT = 'grant-info-collector/1.0 (+https://github.com/Takayama0422/grant-info-collector)';

// 相手に負担をかけないための固定方針。設定で緩められないよう定数に置く。
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 2000;
// 429 / 503 を受けたら再試行せずその場で打ち切る（規約遵守：docs/compliance.md）
const STOP_STATUSES = new Set([429, 503]);

const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

class StopRequested extends Error {
  constructor(message) {
    super(message);
    this.name = 'StopRequested';
  }
}

/**
 * ホストごとに最小間隔を守る。並列リクエストは行わない（逐次実行前提）。
 */
class Throttle {
  constructor(minIntervalMs = 0) {
    this.minIntervalMs = minIntervalMs;
    this.lastAt = 0;
  }

  setMinInterval(ms) {
    if (Number.isFinite(ms) && ms > this.minIntervalMs) this.minIntervalMs = ms;
  }

  async wait() {
    if (this.lastAt === 0) { this.lastAt = Date.now(); return 0; }
    const waitMs = this.minIntervalMs - (Date.now() - this.lastAt);
    if (waitMs > 0) await sleep(waitMs);
    this.lastAt = Date.now();
    return Math.max(waitMs, 0);
  }
}

/**
 * ネットワークを使う取得器。
 */
function createOnlineFetcher({ timeoutMs = 15000, userAgent = USER_AGENT, throttle } = {}) {
  const limiter = throttle ?? new Throttle(0);

  return {
    offline: false,
    throttle: limiter,
    userAgent,
    async fetch(url) {
      let lastError = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        await limiter.wait();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, {
            headers: { 'user-agent': userAgent, accept: 'text/html,text/plain,*/*' },
            redirect: 'follow',
            signal: controller.signal,
          });
          if (STOP_STATUSES.has(response.status)) {
            throw new StopRequested(`取得先が混雑を通知しました（HTTP ${response.status}）。規約遵守のため即座に中止します: ${url}`);
          }
          const text = response.status === 200 ? await response.text() : '';
          return { status: response.status, text, url: response.url || url };
        } catch (error) {
          if (error instanceof StopRequested) throw error;
          lastError = error;
          if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
        } finally {
          clearTimeout(timer);
        }
      }
      throw new Error(`取得に失敗しました（${MAX_ATTEMPTS}回試行）: ${url} / ${safeError(lastError)}`);
    },
  };
}

/**
 * ネットワークを使わない取得器。fixtures/index.json に保存した応答を返す。
 * 取得先が停止・仕様変更しても第三者が動作を再現できるようにするための経路。
 */
function createOfflineFetcher({ fixtureDir } = {}) {
  const directory = fixtureDir ?? path.join(__dirname, '..', 'fixtures');
  const indexPath = path.join(directory, 'index.json');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`固定データが見つかりません: ${indexPath}`);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  return {
    offline: true,
    throttle: new Throttle(0),
    userAgent: USER_AGENT,
    fixtureDir: directory,
    capturedAt: index.captured_at ?? '',
    async fetch(url) {
      const entry = index.entries[url];
      if (!entry) {
        throw new Error(`固定データに該当URLの応答がありません（--offline では設定と固定データを一致させてください）: ${url}`);
      }
      const text = entry.file ? fs.readFileSync(path.join(directory, entry.file), 'utf8') : '';
      return { status: entry.status, text, url };
    },
  };
}

function createFetcher(options = {}) {
  return options.offline ? createOfflineFetcher(options) : createOnlineFetcher(options);
}

module.exports = { MAX_ATTEMPTS, StopRequested, Throttle, USER_AGENT, createFetcher, createOfflineFetcher, createOnlineFetcher, sleep };
