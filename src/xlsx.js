'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');

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
]);

function buildWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('補助金・助成金公募情報');
  sheet.columns = XLSX_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }
  return workbook;
}

async function writeXlsx(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const workbook = buildWorkbook(rows);
  await workbook.xlsx.writeFile(filePath);
}

module.exports = { XLSX_COLUMNS, buildWorkbook, writeXlsx };
