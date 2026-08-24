'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildSearchUrl, parseOrganizationFacets, parseSearchPage, parseTotal, robotsUrls, stripTags, toRecord,
} = require('../src/egov');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');
const fixtureIndex = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'index.json'), 'utf8'));
const HOJOKIN_URL = 'https://data.e-gov.go.jp/data/dataset?q=%E8%A3%9C%E5%8A%A9%E9%87%91';

function readFixture(url) {
  return fs.readFileSync(path.join(FIXTURE_DIR, fixtureIndex.entries[url].file), 'utf8');
}

test('検索URLを組み立てられる', () => {
  assert.equal(buildSearchUrl({ query: '補助金' }), HOJOKIN_URL);
  assert.match(buildSearchUrl({ query: '補助金', organization: 'org_1700', page: 2 }), /organization=org_1700&page=2$/);
});

test('robots.txt はホスト直下とカタログ直下の両方を見る', () => {
  assert.deepEqual(robotsUrls(), [
    { url: 'https://data.e-gov.go.jp/robots.txt', mount: '/' },
    { url: 'https://data.e-gov.go.jp/data/robots.txt', mount: '/data' },
  ]);
});

test('強調表示は語を分断せずに取り除く', () => {
  assert.equal(stripTags('<p>農林水産業の<mark>補助金</mark>等の申請</p>'), '農林水産業の補助金等の申請');
});

test('実際の検索ページから件数・組織・明細を取り出せる', () => {
  const page = parseSearchPage(readFixture(HOJOKIN_URL));
  assert.equal(page.total, 202);
  assert.ok(page.items.length > 0);
  assert.ok(page.organizations.some((organization) => organization.name === '農林水産省' && organization.count > 0));

  const item = page.items[0];
  assert.ok(item.id.length > 0);
  assert.ok(item.title.length > 0);
  assert.match(item.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('件数表記が無ければ0件として扱う', () => {
  assert.equal(parseTotal('<html></html>'), 0);
  assert.deepEqual(parseOrganizationFacets('<html></html>'), []);
});

test('カタログに無い項目は空欄のままにする（推定値を入れない）', () => {
  const record = toRecord(
    { id: 'maff_0001', title: 'テスト公募', description: '概要', publishedAt: '2020-01-01', updatedAt: '2026-01-01', formats: ['CSV', 'PDF'] },
    { source: { name: '情報源', category: '補助金', region: '全国' }, organizationName: '農林水産省', collectedAt: '2026-08-25T00:00:00.000Z' },
  );
  assert.equal(record.organization, '農林水産省');
  assert.equal(record.url, 'https://data.e-gov.go.jp/data/dataset/maff_0001');
  assert.equal(record.amount, '');
  assert.equal(record.application_start, '');
  assert.equal(record.application_deadline, '');
  assert.equal(record.data_formats, 'CSV / PDF');
  assert.equal(record.status, 'ok');
});
