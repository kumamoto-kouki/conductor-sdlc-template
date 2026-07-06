# 2026-07-06 振り返り：v0.4.0 生成物のGit管理除外＋README全面再構成

PO承認済み計画（v0.4.0）の実装。ダッシュボードのビルド生成物をGit管理から外し、連動する仕組み（pre-commitフック・検証ハーネス・複製スクリプト・運用steering・検証rule）を追随させ、READMEを初級〜中級エンジニア向けに全面再構成した。

## 何を実装したか

1. **生成物のGit管理除外**：`.gitignore` に `dashboard/*.html`・`dashboard/_astro/`・`dashboard/reports/`・`dashboard/steering/` を追加。`git rm --cached -r` で追跡済み生成物120ファイルをindexから除去（ディスク上のファイルは残す）。`status.json`・`status.init.json` は引き続き管理対象。
2. **pre-commitフックの目的転換**：「再ビルド＋生成物同梱」を撤去し、ステージに `dashboard/status.json`／`status.init.json` が含まれる場合のみ `node -e` で `src/lib/schema.mjs` の `parseStatus`（動的importでESM経由）を実行してスキーマ検証する内容へ書き換えた。`node_modules` 不在時は検証をスキップして警告（ブロックしない）。
3. **`scripts/verify-dashboard.mjs`**：チェック「2. コミット整合」（`git status --porcelain dashboard/` が空であることの確認）を撤去。前提（生成物がGit管理下にある）が失われたため。残りのチェック（決定性・実描画スモーク2段・要素数レポート・生成HTMLへの静かな値漏出防止・失敗ビルド残留）は維持し、表示番号を1〜5へ振り直した（旧3a/3b→2a/2b等）。
4. **`scripts/init-project.sh`**：rsyncの除外に生成物4パターンを追加。「dashboard/_astro を除外しない（独立レビュー指摘F1）」の特例コメントを撤去し、v0.4.0でこの特例が不要になった経緯を1行残した。初回コミットの `--no-verify` の理由説明も新フックの挙動に合わせて書き換えた。
5. **`.kiro/steering/operations.md`**：「統括が同一コミットでjson更新＋ビルドを行う」規約を「json更新はコミットのみ（フックがスキーマ検証）・閲覧時に `npm run preview`（生成物が無い/古ければ先に `npm run build`）」へ更新。`npm run preview` は自動ビルドしない（`astro preview` の実挙動）ことを明記し、誤った「内部で自動ビルドする」という記述は避けた。
6. **README.md 全面再構成**：旧README（53行・情報削除ゼロ）を新構成8節（これは何か→5分で始める→画面で進捗を見る→始める前のチェックリスト→中身の地図→この進め方のルール→困ったとき・FAQ→経緯・注意）へ再編し、Mermaid図5枚（全体フロー・体制図・5分手順・フォルダ地図・ダッシュボード運用）を追加。専門用語（steering・spec・worktree・EARS・コンダクター）は初出時に括弧書きで平易説明。クローン直後は生成物が無いため `npm install`＋`npm run build` が前提になる点を明記。
7. **付随**：`VERSION` を 0.3.0→0.4.0 に更新。

## トレードオフ

- **失ったもの**：クローン直後に `dashboard/status-dashboard.html` を `file://` で即閲覧できる利便性。生成物がGit管理外になったため、`npm install`＋`npm run build` を経ないと何も表示されない。
- **得たもの**：`status.json`（入力）とビルド出力（生成物）の不一致がコミット単位で起き得なくなる（生成物自体がコミット対象でなくなるため）。リポジトリの差分ノイズ（Astroのハッシュ付きチャンクファイル等120ファイル）が消え、実質的な変更（steering・spec・コード）のdiffが読みやすくなる。
- **受け入れ理由**：PO判断（本タスクの承認事項）。閲覧の手間（2コマンド）は、生成物の食い違い事故・diffノイズという既知の問題より許容範囲と判断。

## 詰まった点・繰り返した判断

- **pre-commitフックのESM解決**：`src/lib/schema.mjs` は `import { z } from "zod"` を使うESMファイルのため、`node -e` 内で `require()` すると `ERR_REQUIRE_ESM` で失敗する。動的 `import()` に切り替えることで解決した（`node -e` はCommonJSとして評価されるが、動的importはCJSコンテキストからでも使える）。
- **`npm run preview` の挙動誤認に注意**：当初「生成物が無ければ内部で自動ビルドする」という記述をoperations.mdに書きかけたが、`astro preview` は既存のビルド出力を配信するだけで自動ビルドしない（`scripts/serve-dashboard.sh` のコメントでも同様に明記済み）。実際の挙動を確認してから記述を修正した。writing-standards.md の「未確認のことを確認済みのように書かない」に沿って、確認前の記述は残さなかった。
- **`checkElementCountReport`（要素数レポート）の前提が今後変わる**：このチェックは `git show HEAD:dashboard/${rel}` で直前コミットの生成物と比較する。v0.4.0コミット以降、生成物はGit管理外になるため、次回以降のverify実行では全ページが「HEAD未存在・新規ページ」判定になり、実質的にHEAD比較が機能しなくなる（コード自体は「新規ページ」として警告なしで通す設計のため、エラーにはならないが目的を果たさなくなる）。PO指示は「維持」だったため実装は変更していないが、次回の振り返りで対応を検討する価値がある。

## `.claude/rules/` / 正本への格上げ

- 済み：`.kiro/steering/operations.md` のダッシュボード運用規約を更新（json更新とビルドの分離）
- 候補（今回は様子見）：`checkElementCountReport` のHEAD比較が実質機能しなくなる件は、2回目に同じ判断が必要になったら `.claude/rules/dashboard-verification.md` へ格上げを検討

## 次回への持ち越し

- `checkElementCountReport` のHEAD比較ロジックの是正（「直前ビルド時のスナップショットをどこかに保存して比較する」等の代替設計が必要）
- README記載のNode.jsバージョン要件・トラブルシューティングFAQは実プロジェクトでの運用開始後に追記候補があれば拡充
