'use strict';

// robots.txt の解釈。
//
// 仕様上 robots.txt はホスト直下（/robots.txt）にあるものだけが正式な指定である。
// ただし本ツールの取得先である e-Govデータポータルは、カタログ機能を /data/ 配下に
// 載せており、/data/robots.txt にも拒否指定が置かれている（ホスト直下は404）。
// どちらを正とするか仕様上あいまいなため、本ツールは**厳しい側**に倒し、
// 「マウント位置直下の robots.txt も、その位置を基準として有効」とみなして従う。
// 詳細と原文は docs/compliance.md に記録している。

function parseRobots(text) {
  const groups = [];
  let current = null;
  let expectingAgent = false;

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!current || !expectingAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
        expectingAgent = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    expectingAgent = false;

    if (field === 'disallow' || field === 'allow') {
      current.rules.push({ allow: field === 'allow', path: value });
    } else if (field === 'crawl-delay') {
      const delay = Number.parseFloat(value);
      if (Number.isFinite(delay)) current.crawlDelay = delay;
    }
  }
  return groups;
}

function selectGroup(groups, userAgent) {
  const agent = String(userAgent).toLowerCase();
  const specific = groups.find((group) => group.agents.some((name) => name !== '*' && agent.includes(name)));
  if (specific) return specific;
  return groups.find((group) => group.agents.includes('*')) ?? { agents: ['*'], rules: [], crawlDelay: null };
}

function ruleToRegExp(pattern) {
  let source = '^';
  for (const character of pattern) {
    if (character === '*') source += '.*';
    else if (character === '$') source += '$';
    else source += character.replace(/[.+?^${}()|[\]\\]/gu, '\\$&');
  }
  return new RegExp(source, 'u');
}

/**
 * 最長一致優先。同じ長さで衝突した場合は許可を優先する（一般的な実装に合わせる）。
 */
function isAllowed(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (rule.path === '') continue; // 空の Disallow は「制限なし」の意味
    if (!ruleToRegExp(rule.path).test(path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

/**
 * マウント位置を基準に解釈したルールへ変換する。
 * 例: mount="/data" のとき "Disallow: /api/" は "/data/api/" として扱う。
 */
function rebaseRules(rules, mount) {
  if (!mount || mount === '/') return rules;
  const prefix = mount.replace(/\/$/, '');
  return rules.map((rule) => ({ ...rule, path: rule.path.startsWith('/') ? `${prefix}${rule.path}` : rule.path }));
}

/**
 * 複数の robots.txt（ホスト直下＋マウント直下）を1つの判定器へまとめる。
 *
 * @param {Array<{text: string|null, mount: string}>} documents
 * @param {string} userAgent
 */
function buildPolicy(documents, userAgent) {
  const rules = [];
  let crawlDelay = 0;
  for (const document of documents) {
    if (!document || typeof document.text !== 'string') continue;
    const group = selectGroup(parseRobots(document.text), userAgent);
    rules.push(...rebaseRules(group.rules, document.mount));
    if (group.crawlDelay) crawlDelay = Math.max(crawlDelay, group.crawlDelay);
  }
  return {
    crawlDelayMs: crawlDelay * 1000,
    isAllowed: (path) => isAllowed(rules, path),
    ruleCount: rules.length,
  };
}

module.exports = { buildPolicy, isAllowed, parseRobots, rebaseRules, selectGroup };
