'use strict';

// e-Govデータポータル（CKAN 2.9系）のデータセット検索ページを解釈する。
// 公開APIではなく通常のHTMLページを使う。理由は docs/compliance.md の robots.txt の項に記録。

const ORIGIN = 'https://data.e-gov.go.jp';
const SEARCH_PATH = '/data/dataset';
const MOUNT = '/data';
const PAGE_SIZE = 20;

function buildSearchUrl({ query, organization = '', page = 1, origin = ORIGIN, searchPath = SEARCH_PATH } = {}) {
  const url = new URL(searchPath, origin);
  if (query) url.searchParams.set('q', query);
  if (organization) url.searchParams.set('organization', organization);
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}

function robotsUrls(origin = ORIGIN) {
  return [
    { url: new URL('/robots.txt', origin).toString(), mount: '/' },
    { url: new URL(`${MOUNT}/robots.txt`, origin).toString(), mount: MOUNT },
  ];
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name) => {
    if (Object.hasOwn(ENTITIES, name)) return ENTITIES[name];
    if (name.startsWith('#x') || name.startsWith('#X')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return whole;
  });
}

function stripTags(html) {
  // 検索語の強調（<mark>）は語の途中に入るため、空白を挟まずに取り除く。
  const withoutHighlight = String(html).replace(/<\/?mark[^>]*>/g, '');
  return decodeEntities(withoutHighlight.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseTotal(html) {
  const match = /([0-9,]+)\s*件のデータセット/.exec(html);
  return match ? Number.parseInt(match[1].replaceAll(',', ''), 10) : 0;
}

function parseOrganizationFacets(html) {
  const facets = [];
  const seen = new Set();
  const pattern = /<a[^>]*class="list_accordion_facet_link"[^>]*href="[^"]*organization=(org_\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    const id = match[1];
    if (seen.has(id)) continue;
    const inner = match[2];
    const countMatch = /facet_condition_amount[^>]*>\s*\(([0-9,]+)\)/.exec(inner);
    const name = stripTags(inner.replace(/<span[^>]*facet_condition_amount[\s\S]*?<\/span>/g, ''));
    seen.add(id);
    facets.push({ id, name, count: countMatch ? Number.parseInt(countMatch[1].replaceAll(',', ''), 10) : 0 });
  }
  return facets;
}

function parseItemBlock(block) {
  const titleMatch = /<a[^>]*class="[^"]*list_dataset_item_title[^"]*"[^>]*href="\/data\/dataset\/([^"?#]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
  if (!titleMatch) return null;

  const paragraphs = [...block.matchAll(/<p class="text text_px14[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => stripTags(m[1]));
  const pick = (label) => {
    const found = paragraphs.find((text) => text.startsWith(label));
    return found ? found.slice(label.length).replace(/^[:：]\s*/, '').trim() : '';
  };
  const description = paragraphs.find((text) => !/^(提供開始日|メタデータ更新日)/.test(text)) ?? '';

  const formats = [...block.matchAll(/data-format="[^"]*"[^>]*>([^<]+)<\/a>/g)]
    .map((m) => stripTags(m[1]).toUpperCase())
    .filter(Boolean);

  return {
    id: titleMatch[1],
    title: stripTags(titleMatch[2]),
    description,
    publishedAt: pick('提供開始日'),
    updatedAt: pick('メタデータ更新日'),
    formats: [...new Set(formats)],
  };
}

function parseSearchPage(html) {
  const text = String(html);
  const blocks = text.split(/<li class="list_dataset_item">/).slice(1);
  const items = blocks.map(parseItemBlock).filter(Boolean);
  return { total: parseTotal(text), organizations: parseOrganizationFacets(text), items };
}

/**
 * 検索結果1件を GrantRecord へ正規化する。
 * カタログに存在しない項目（金額・受付開始日・受付締切日）は空欄のままにし、推定値を入れない。
 */
function toRecord(item, context) {
  const { source, organizationName, collectedAt, origin = ORIGIN } = context;
  const detail = new URL(`${SEARCH_PATH}/${item.id}`, origin).toString();
  return {
    collected_at: collectedAt,
    title: item.title,
    organization: organizationName || source.organizationLabel || '',
    category: source.category || '',
    region: source.region || '',
    amount: '',
    application_start: '',
    application_deadline: '',
    url: detail,
    source: source.name,
    status: 'ok',
    summary: item.description,
    data_formats: item.formats.join(' / '),
    updated_at: item.updatedAt || item.publishedAt || '',
  };
}

module.exports = {
  MOUNT,
  ORIGIN,
  PAGE_SIZE,
  SEARCH_PATH,
  buildSearchUrl,
  decodeEntities,
  parseItemBlock,
  parseOrganizationFacets,
  parseSearchPage,
  parseTotal,
  robotsUrls,
  stripTags,
  toRecord,
};
