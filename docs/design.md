# Grant Info Collector 設計メモ

現段階は土台（構成・環境・雛形）のみ。データ取得ロジックは別タスクで実装する。
このメモは実装が進むたびに更新する。

## 全体の流れ

```
config/sources.json          収集対象の情報源を定義（settings + sources[]）
        │
        ▼
src/config.js                 設定を検証・正規化する（validateConfig）
        │
        ▼
src/collector.js               ソースごとに収集する（collectFromSource は未実装 = 差し込み口）
        │  GrantRecord[] を返す
        ▼
src/csv.js / src/xlsx.js       GrantRecord[] を CSV・XLSX に整形する
        │
        ▼
reports/latest/ (実行時)       grants.csv / grants.xlsx
reports/sample/ (成果例)       実装完了後に置く
```

## GrantRecord（収集結果1件の形）

`src/collector.js` にJSDocで定義。CSV・XLSXの出力列と1対1で対応させる。

| フィールド | 内容 |
|---|---|
| collected_at | 収集日時（ISO 8601） |
| title | 公募名 |
| organization | 実施主体 |
| category | 分類（例: 補助金 / 助成金） |
| region | 対象地域 |
| amount | 金額・上限額（テキストのまま） |
| application_start | 受付開始日 |
| application_deadline | 受付締切日 |
| url | 詳細ページURL |
| source | 情報源名 |
| status | 取得状態（ok / error） |

## 収集ロジックの差し込み口

`src/collector.js` の `collectFromSource(source)` が未実装の唯一の関数。
ソース種別（`type`）ごとに実装を分岐させる想定（例: `html` スクレイピング、`rss`、`api`）。
`collectGrants(config)` 側のインターフェースは固定済みなので、`collectFromSource` を
実装するだけで CLI・CSV・XLSX 出力・テストの土台はそのまま使える。

## 認証情報の扱い

- 既定（`settings.allowAuthenticatedSources: false`）では、`authRequired: true` の
  ソースを含む設定は起動時に拒否する（`src/config.js`）。
- 将来、認証が必要な情報源を扱う場合は、設定側で明示的に許可した上で、
  鍵は `.env` 経由で渡し、リポジトリには含めない（`config/*.example.json` に実値を書かない）。

## 未実装・今後の検討事項

- `collectFromSource` の実データ取得ロジック（対象サイトの選定・利用規約確認は
  `docs/compliance.md` を参照）
- web-site-checker のようなネットワーク境界の制御（許可ホストの限定・プロキシ経由の
  一本化）は、実際に外部アクセスを行うロジックが入った時点で検討する。現時点では
  収集ロジックが存在しないため、過剰な作り込みを避けている
- 定期実行（スケジューラ）の要否
