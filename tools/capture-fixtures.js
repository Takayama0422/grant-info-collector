#!/usr/bin/env node
'use strict';

// 開発用スクリプト。実際の取得と同じ手順を1回だけ実行し、応答を fixtures/ へ保存する。
// 取得先が停止・仕様変更しても第三者が動かせるようにするための固定データを作る。
// 通常の収集では使わない（本番経路は src/cli.js）。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadConfig } = require('../src/config');
const { collectGrants } = require('../src/collector');
const { createOnlineFetcher } = require('../src/http');

const root = path.join(__dirname, '..');
const fixtureDir = path.join(root, 'fixtures');

async function main() {
  const configPath = process.argv[2] ?? path.join(root, 'config', 'sources.json');
  const config = loadConfig(configPath);

  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.mkdirSync(fixtureDir, { recursive: true });

  const online = createOnlineFetcher({ timeoutMs: config.settings.timeoutMs });
  online.throttle.setMinInterval(config.settings.delayBetweenSourcesMs ?? 0);

  const entries = {};
  const recorder = {
    offline: false,
    throttle: online.throttle,
    userAgent: online.userAgent,
    async fetch(url) {
      const response = await online.fetch(url);
      const extension = new URL(url).pathname.endsWith('robots.txt') ? 'txt' : 'html';
      const name = `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}.${extension}`;
      if (response.status === 200) fs.writeFileSync(path.join(fixtureDir, name), response.text, 'utf8');
      entries[url] = { status: response.status, file: response.status === 200 ? name : null };
      process.stdout.write(`保存: HTTP ${response.status} ${url}\n`);
      return response;
    },
  };

  const records = await collectGrants(config, { fetcher: recorder, collectedAt: new Date().toISOString() });

  fs.writeFileSync(
    path.join(fixtureDir, 'index.json'),
    `${JSON.stringify({
      note: 'e-Govデータポータルから取得した応答の写し。ネットワーク無しで動作を再現するために同梱する。出典: e-Govデータポータル（デジタル庁）／公共データ利用規約（第1.0版）PDL1.0',
      captured_at: new Date().toISOString(),
      config: path.relative(root, configPath),
      entries,
    }, null, 2)}\n`,
    'utf8',
  );
  process.stdout.write(`固定データ ${Object.keys(entries).length} 件 / 収集 ${records.length} 件を保存しました。\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
