# Grant Info Collector

補助金・助成金の公募情報を自動収集し、表（CSV/XLSX）に整形して出力するツール。

**現在の状態: 土台（構成・環境・雛形）のみ。データ取得ロジックは別途実装する。**
このREADMEの各項目は、実装・検証が完了し次第、実測値・実物へ差し替える。

## ① 出力画面の画像

（後で追加。実装完了後にサンプル出力のスクリーンショットをここに置く）

## ② 1行で「何の手作業がなくなるか」

（後で記入。実装完了後、実際になくなる手作業を1行で書く）

## ③ before/after表

| 項目 | before（手作業） | after（本ツール） |
|---|---|---|
| （後で記入） | （後で記入・実測のみ） | （後で記入・実測のみ） |

架空の「改善前」は作らない。実測していない数値は書かない（詳細: [`docs/measurement.md`](docs/measurement.md)）。

## ④ 出力サンプルと公開デモURL

- 出力サンプル: [`reports/sample/`](reports/sample/)（実装完了後に格納）
- 公開デモURL: （後で記入）

## ⑤ 利用規約・robots確認の記録

外部サイトへアクセスする収集ロジックを実装する前に、対象サイトの利用規約と
`robots.txt` を確認し、その記録を [`docs/compliance.md`](docs/compliance.md) にまとめる。

## ⑥ Dockerでの再現手順

ローカルに Node.js を必要としない。Docker のみで完結する。

```bash
# 設定ファイルを用意する（実値は入れない場合はサンプルのままでよい）
cp config/sources.example.json config/sources.json

# 依存関係を含めてビルド
docker compose build

# 収集を実行（収集ロジック実装後に有効）
docker compose run --rm collector

# 検証用（構文チェック・テスト）
docker compose run --rm collector sh -c "npm run validate && npm test"
```

出力は `reports/latest/`（Git管理対象外）に作られる。

## ⑦ 仕組み図

[`docs/design.md`](docs/design.md) を参照。

## ⑧ できないこと・制約

- 現時点で実データの収集ロジックは未実装（`src/collector.js` の `collectFromSource` が差し込み口）
- 認証情報が必要な情報源は既定で拒否する（`settings.allowAuthenticatedSources` を明示的に有効化しない限り使えない）
- 定期実行（スケジューラ）の仕組みは含まない
- 対象サイトの利用規約・`robots.txt` を確認できない、または自動アクセスを拒否している情報源は対象にしない
