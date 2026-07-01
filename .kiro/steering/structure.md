# structure.md — ディレクトリ／コード構成（記入テンプレ）

> `/kiro-steering` で埋めるか、手で記入する。どこに何があるか・命名・設計上の不変条件。

## ディレクトリ

```
（例）
src/            アプリコード
  ...
docs/           ドキュメント（status-dashboard.html＝進行の唯一のソース）
.kiro/
  steering/     プロジェクト記憶（本ディレクトリ）
  specs/        機能ごとの仕様（requirements/design/tasks）
.claude/
  skills/       kiro-* SDLC スキル
  rules/        パス連動の判断基準（lazy）
  reports/      振り返り
scripts/        並行開発の道具（swarm / dev-board）
```

## 命名・配置の規約

- （例 テストは同階層 `*.test.*`／設定は…）

## 設計上の不変条件

- （例 レイヤー間の責務境界・状態の単一ソース 等。壊すと事故になる約束をここに）
