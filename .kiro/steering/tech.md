# tech.md — 技術スタック・制約（記入テンプレ）

> `/kiro-steering` で埋めるか、手で記入する。採用技術と、それに伴う制約・規約を書く。

## スタック

- 言語／ランタイム: （例）
- フレームワーク／主要ライブラリ: （例）
- テスト: （例 ユニット／DOM／E2E／スナップショット）
- ビルド／型チェック: （例）

## コマンド（検証の要）

- テスト: `（例 npm test / pytest / go test）`
- 型チェック: `（例 npm run check / mypy / tsc）`
- ビルド: `（例 npm run build / make build）`
- E2E: `（例 npm run e2e / playwright test）`

> 受理は**このコマンドの実出力（新鮮な証拠）**で行う（`kiro-verify-completion`）。
> このテンプレ本体リポジトリ自身（`.kiro/steering/` 等ドキュメントの検証）は `npm run verify` / `npm run build` で行う。

## 制約・方針

- セキュリティ: （例 シークレットは keyring／照会は有無のみ／通信先を絞る）
- パフォーマンス: （例 バンドル・起動）
- 依存を増やさない方針: （例）

## スタック依存の判断基準（rules へ）

- 実装後、2 回目に同じ判断をしたら `.claude/rules/<name>.md`（path-glob lazy）に切り出す。参考例は `.claude/rules/_examples/`。
