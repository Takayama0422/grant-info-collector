'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { writeXlsx, XLSX_COLUMNS } = require('../src/xlsx');

test('xlsxを書き出して読み戻せる', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'grant-xlsx-'));
  const filePath = path.join(directory, 'grants.xlsx');

  await writeXlsx(filePath, [
    {
      collected_at: '2026-08-25T00:00:00.000Z',
      title: 'サンプル公募',
      organization: 'サンプル省庁',
      category: '補助金',
      region: '全国',
      amount: '上限100万円',
      application_start: '2026-09-01',
      application_deadline: '2026-10-31',
      url: 'https://example.com/grants/1',
      source: 'サンプル情報源',
      status: 'ok',
    },
  ]);

  assert.equal(fs.existsSync(filePath), true);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  assert.equal(sheet.getRow(1).getCell(1).value, XLSX_COLUMNS[0].header);
  assert.equal(sheet.getRow(2).getCell(2).value, 'サンプル公募');

  fs.rmSync(directory, { recursive: true, force: true });
});
