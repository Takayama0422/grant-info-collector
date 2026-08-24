'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { noticeRows } = require('./notice');

// 先頭11列は GrantRecord の基本形（docs/design.md）。末尾3列は追記のみの付加情報。
const XLSX_COLUMNS = Object.freeze([
  { header: '収集日時', key: 'collected_at', width: 22 },
  { header: '公募名', key: 'title', width: 40 },
  { header: '実施主体', key: 'organization', width: 24 },
  { header: '分類', key: 'category', width: 14 },
  { header: '対象地域', key: 'region', width: 14 },
  { header: '金額', key: 'amount', width: 18 },
  { header: '受付開始日', key: 'application_start', width: 14 },
  { header: '受付締切日', key: 'application_deadline', width: 14 },
  { header: 'URL', key: 'url', width: 40 },
  { header: '情報源', key: 'source', width: 20 },
  { header: '状態', key: 'status', width: 10 },
  { header: '概要', key: 'summary', width: 50 },
  { header: 'データ形式', key: 'data_formats', width: 20 },
  { header: '更新日', key: 'updated_at', width: 14 },
]);

const NOTICE_SHEET_NAME = '出典・利用条件';

function addNoticeSheet(workbook, extraRows = []) {
  const sheet = workbook.addWorksheet(NOTICE_SHEET_NAME);
  sheet.columns = [
    { header: '項目', key: 'label', width: 16 },
    { header: '内容', key: 'value', width: 110 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const [label, value] of [...noticeRows(), ...extraRows]) {
    sheet.addRow({ label, value });
  }
  return sheet;
}

function buildWorkbook(rows, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('補助金・助成金公募情報');
  sheet.columns = XLSX_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of rows) {
    sheet.addRow(row);
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: XLSX_COLUMNS.length } };
  // 出典・加工主体の明記は利用規約上の義務。ファイル自身に必ず含める。
  addNoticeSheet(workbook, options.extraNoticeRows ?? []);
  return workbook;
}

async function writeXlsx(filePath, rows, options = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const workbook = buildWorkbook(rows, options);
  await workbook.xlsx.writeFile(filePath);
}

module.exports = { NOTICE_SHEET_NAME, XLSX_COLUMNS, addNoticeSheet, buildWorkbook, writeXlsx };
