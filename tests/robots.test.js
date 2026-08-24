'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPolicy, isAllowed, parseRobots, rebaseRules, selectGroup } = require('../src/robots');

const EGOV_DATA_ROBOTS = [
  'User-agent: *',
  'Disallow: /dataset/rate/',
  'Disallow: /revision/',
  'Disallow: /dataset/*/history',
  'Disallow: /api/',
  'Crawl-Delay: 10',
].join('\n');

test('User-agent と Disallow を読み取れる', () => {
  const groups = parseRobots(EGOV_DATA_ROBOTS);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].agents, ['*']);
  assert.equal(groups[0].crawlDelay, 10);
  assert.equal(groups[0].rules.length, 4);
});

test('自分に当てはまるグループを選ぶ', () => {
  const groups = parseRobots('User-agent: badbot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/');
  assert.deepEqual(selectGroup(groups, 'grant-info-collector/1.0').rules, [{ allow: false, path: '/private/' }]);
  assert.deepEqual(selectGroup(groups, 'BadBot/2.0').rules, [{ allow: false, path: '/' }]);
});

test('ワイルドカードを含む拒否経路を判定できる', () => {
  const rules = selectGroup(parseRobots(EGOV_DATA_ROBOTS), '*').rules;
  assert.equal(isAllowed(rules, '/dataset/abc/history'), false);
  assert.equal(isAllowed(rules, '/api/3/action/package_search'), false);
  assert.equal(isAllowed(rules, '/dataset'), true);
});

test('Allow は同じ長さなら Disallow より優先する', () => {
  const rules = selectGroup(parseRobots('User-agent: *\nDisallow: /a/\nAllow: /a/'), '*').rules;
  assert.equal(isAllowed(rules, '/a/b'), true);
});

test('マウント位置を基準に読み替えられる', () => {
  const rules = rebaseRules(selectGroup(parseRobots(EGOV_DATA_ROBOTS), '*').rules, '/data');
  assert.equal(isAllowed(rules, '/data/api/3/action/status_show'), false);
  assert.equal(isAllowed(rules, '/api/3/action/status_show'), true);
  assert.equal(isAllowed(rules, '/data/dataset'), true);
});

test('ホスト直下とマウント直下の指定を厳しい側にまとめる', () => {
  const policy = buildPolicy(
    [
      { text: null, mount: '/' },
      { text: EGOV_DATA_ROBOTS, mount: '/data' },
    ],
    'grant-info-collector/1.0',
  );
  assert.equal(policy.crawlDelayMs, 10000);
  assert.equal(policy.isAllowed('/data/dataset'), true);
  assert.equal(policy.isAllowed('/data/api/3/action/package_search'), false);
});

test('空の Disallow は制限なしとして扱う', () => {
  const rules = selectGroup(parseRobots('User-agent: *\nDisallow:'), '*').rules;
  assert.equal(isAllowed(rules, '/anything'), true);
});
