#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { collectGrants } = require('./collector');
const { writeCsv } = require('./csv');
const { writeXlsx } = require('./xlsx');
const { safeError } = require('./redaction');

function printHelp() {
  process.stdout.write(`
Grant Info Collector

使い方:
  node src/cli.js --config <設定JSON> [--output reports/latest] [--format csv,xlsx]

オプション:
  --config   対象ソースを定義したJSON（必須）
  --output   出力先ディレクトリ（既定: reports/latest）
  --format   出力形式。csv, xlsx をカンマ区切りで指定（既定: 設定ファイルの settings.outputFormats）
  --help     このヘルプを表示
`);
}

function parseArguments(argv) {
  const parsed = { config: '', output: 'reports/latest', format: '', help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') { parsed.help = true; continue; }
    if (argument === '--config' || argument === '--output' || argument === '--format') {
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

  try {
    const config = loadConfig(arguments_.config);
    const formats = resolveFormats(arguments_, config);
    process.stdout.write(`収集開始: ${config.sources.length} ソース\n`);

    const records = await collectGrants(config, {
      onSourceStart(source, index, total) {
        process.stdout.write(`[${index + 1}/${total}] ${source.name} を収集中...\n`);
      },
    });

    fs.mkdirSync(arguments_.output, { recursive: true });
    if (formats.includes('csv')) writeCsv(path.join(arguments_.output, 'grants.csv'), records);
    if (formats.includes('xlsx')) await writeXlsx(path.join(arguments_.output, 'grants.xlsx'), records);

    process.stdout.write(`収集完了: ${records.length} 件 (${formats.join(', ')})\n`);
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(`実行エラー: ${safeError(error)}\n`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();

module.exports = { main, parseArguments, resolveFormats };
