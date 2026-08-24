'use strict';

// 公共データ利用規約（第1.0版／PDL1.0）が求める「出典の記載」と
// 「編集・加工等を行ったこと及びその主体の記載」を、出力ファイル自身へ埋め込むための文言。
// docs/compliance.md の記録と対応させること。

const SOURCE_NAME = 'e-Govデータポータル（デジタル庁）';
const SOURCE_URL = 'https://data.e-gov.go.jp/data/dataset';
const LICENSE_NAME = '公共データ利用規約（第1.0版）PDL1.0';
const LICENSE_URL = 'https://www.digital.go.jp/resources/open_data/public_data_license_v1.0';
const PROCESSOR = 'grant-info-collector';

// 出典記載例は e-Govデータポータルの「PDL1.0に関する重要情報」が示す書式に合わせる。
const NOTICE_LINES = Object.freeze([
  `出典：${SOURCE_NAME}（${SOURCE_URL}）`,
  `利用条件：${LICENSE_NAME}（${LICENSE_URL}）`,
  `加工の有無：あり。「データセット検索結果」（デジタル庁 e-Govデータポータル）（${SOURCE_URL}）をもとに ${PROCESSOR} が作成。`,
  `加工主体：${PROCESSOR}（本ツールの実行者）。デジタル庁が作成した未加工の情報ではない。`,
  '未取得の列：金額・受付開始日・受付締切日は、出典側のカタログに項目が無いため空欄とする（推定値は入れない）。',
]);

function noticeText(separator = ' / ') {
  return NOTICE_LINES.join(separator);
}

function noticeRows() {
  return NOTICE_LINES.map((line) => {
    const index = line.indexOf('：');
    return index < 0 ? ['', line] : [line.slice(0, index), line.slice(index + 1)];
  });
}

module.exports = {
  LICENSE_NAME,
  LICENSE_URL,
  NOTICE_LINES,
  PROCESSOR,
  SOURCE_NAME,
  SOURCE_URL,
  noticeRows,
  noticeText,
};
