#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { collectGrants, dedupeRecords } = require('./collector');
const { createFetcher } = require('./http');
const { writeCsv } = require('./csv');
const { writeXlsx } = require('./xlsx');
const { safeError } = require('./redaction');
const { NOTICE_LINES } = require('./notice');

const FLAGS = new Set(['--help', '-h', '--offline', '--timestamp']);
const VALUE_OPTIONS = new Set(['--config', '--output', '--format']);

function printHelp() {
  process.stdout.write(`
Grant Info Collector

使い方:
  node src/cli.js --config <設定JSON> [--output reports/runs] [--timestamp] [--offline] [--format csv,xlsx]

オプション:
  --config     対象ソースを定義したJSON（必須）
  --output     出力先ディレクトリ（既定: reports/latest）
  --timestamp  出力先の下に実行日時のフォルダを作る（reports/runs/20260825-014500 など）
  --offline    ネットワークを使わず fixtures/ の固定データで実行する
  --format     出力形式。csv, xlsx をカンマ区切りで指定（既定: 設定ファイルの settings.outputFormats）
  --help       このヘルプを表示
`);
}

function parseArguments(argv) {
  const parsed = { config: '', output: 'reports/latest', format: '', help: false, offline: false, timestamp: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') { parsed.help = true; continue; }
    if (argument === '--offline') { parsed.offline = true; continue; }
    if (argument === '--timestamp') { parsed.timestamp = true; continue; }
    if (VALUE_OPTIONS.has(argument)) {
      const value = argv[index + 1] ?? '';
      index += 1;
      parsed[argument.slice(2)] = value;
      continue;
    }
    throw new Error(`不明なオプションです: ${argument}`);
  }
  if (!parsed.help && !parsed.config) throw new Error('--config を指定してください。');
  if (!parsed.help && !parsed.output) throw new Error('--output に空文字は指定できません。');
  return parsed;
}

function resolveFormats(arguments_, config) {
  if (!arguments_.format) return config.settings.outputFormats;
  const requested = arguments_.format.split(',').map((format) => format.trim()).filter(Boolean);
  if (requested.length === 0) throw new Error('--format に有効な値がありません。');
  return requested;
}

function timestampFolder(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function resolveOutputDirectory(arguments_, date = new Date()) {
  return arguments_.timestamp ? path.join(arguments_.output, timestampFolder(date)) : arguments_.output;
}

async function main() {
  let arguments_;
  try {
    arguments_ = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`入力エラー: ${safeError(error)}\n`);
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (arguments_.help) { printHelp(); return; }

  const startedAt = Date.now();
  try {
    const config = loadConfig(arguments_.config);
    const formats = resolveFormats(arguments_, config);
    const fetcher = createFetcher({ offline: arguments_.offline, timeoutMs: config.settings.timeoutMs });
    fetcher.throttle.setMinInterval(config.settings.delayBetweenSourcesMs ?? 0);

    process.stdout.write(
      `収集開始: ${config.sources.length} ソース${arguments_.offline ? '（オフライン／固定データ）' : '（ネットワーク取得）'}\n`,
    );

    const collected = await collectGrants(config, {
      fetcher,
      onSourceStart(source, index, total) {
        process.stdout.write(`[${index + 1}/${total}] ${source.name} を収集中...\n`);
      },
      onProgress(event) {
        if (event.kind === 'index') {
          process.stdout.write(`    該当 ${event.total} 件 / 組織 ${event.organizations} 種\n`);
        } else {
          process.stdout.write(`    ${event.organization} (${event.page}ページ目): ${event.count} 件\n`);
        }
      },
    });
    const records = dedupeRecords(collected);

    const outputDirectory = resolveOutputDirectory(arguments_);
    fs.mkdirSync(outputDirectory, { recursive: true });
    if (formats.includes('csv')) writeCsv(path.join(outputDirectory, 'grants.csv'), records, NOTICE_LINES);
    if (formats.includes('xlsx')) {
      await writeXlsx(path.join(outputDirectory, 'grants.xlsx'), records, {
        extraNoticeRows: [
          ['収集日時', records[0]?.collected_at ?? new Date().toISOString()],
          ['収集件数', String(records.length)],
          ['取得方法', arguments_.offline ? 'fixtures/ の固定データ（ネットワーク未使用）' : 'HTTP取得（robots.txt の Crawl-delay 遵守・逐次）'],
        ],
      });
    }

    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    process.stdout.write(
      `収集完了: ${records.length} 件（重複除外前 ${collected.length} 件） / ${formats.join(', ')} / ${elapsedSeconds} 秒 / 出力先 ${outputDirectory}\n`,
    );
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(`実行エラー: ${safeError(error)}\n`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();

module.exports = { main, parseArguments, resolveFormats, resolveOutputDirectory, timestampFolder };
