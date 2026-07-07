# CHANGELOG

[Keep a Changelog](https://keepachangelog.com/) の形式に準拠する。バージョンは [Semantic Versioning](https://semver.org/) に従う（互換性を壊す構造変更＝MAJOR、機能追加＝MINOR、文言修正等の軽微な変更＝PATCH）。

このファイルは「時系列の変更事実」専用。教訓・判断基準は書かない（正本＝`.kiro/steering/`・`.claude/rules/`・`.claude/playbooks/`に置く）。

## 成り立ち

`conductor-sdlc-template` は、実プロジェクト（Tauri デスクトップアプリ）の開発で確立した「AI エージェント主体の進め方」——コンダクター・オーケストレーション（メインの AI セッションが指揮役となり複数のワーカーへ実装を割り振り独立レビューで受け取る体制）＋ Kiro Spec-Driven Development（要件→設計→タスクの3段階承認）＋可視化ダッシュボード——を、次のプロジェクトの起点として切り出したテンプレートである。元プロジェクトを保留する際、そこで培ったノウハウを次に活かすため PO 指示でテンプレート化した。名前は手法を一目で表す記述的な名前として PO が選定した。

切り出し時の主要な設計判断は次のとおり。

- **そのまま再利用**：`.claude/skills/kiro-*`（SDLC スキル群）・`scripts/`・`.claude/hooks/format-on-edit.mjs`・`.claude/settings.json`・rules/reports の README。
- **汎用化**：CLAUDE.md・steering 一式・ダッシュボードから固有名（製品名・ブランチ名・spec 名・技術選定の具体名）を除去した。
- **ペルソナの匿名化**：標準キャスト（統括／運用／Eng リーダー／Design リーダー等）は残しつつ、個人名風の苗字を役割ラベルへ置き換えた。
- **事故記号の注記**：元プロジェクトの事故記号（A2/K1 等）や具体例は「実プロジェクトの例」と注記し、教訓のみを受け取れる形にした。
- **ダッシュボードは構造のみ再利用**：数値・タスク・更新履歴はすべて例示データとし、冒頭にテンプレート注記のバナーを置いた。
- **スタック依存 rules の分離**：実装スタックに依存する `.claude/rules/` は `_examples/` へ移し、実スタック向けは各プロジェクトが実装後に作る。

## [Unreleased]

### 既知の課題

- worktree 環境での Astro ビルドに非決定性がある（BaseHead ハッシュが実行ごとに変わる）。
- `scripts/verify-dashboard.mjs` の要素数チェックは `git show HEAD:<path>` で直前コミットの生成物と比較する設計だが、v0.4.0 でダッシュボードの生成物を Git 管理外にした副作用により、比較対象が常に「新規ページ」判定になり HEAD 比較が実質機能しない。

## [0.6.0] - 2026-07-07

- `role-catalog.md` の候補ロスターへ **🧑‍🚀 FDE（フォワードデプロイド）** を追加した（出典: [Forward Deployed Engineer](https://zenn.dev/hellorusk/articles/f75f6d41b0a30c)）。実在の現場・ステークホルダーに直接常駐する Maker 役で、Eng/Design 両レーンに対応する。権限は実装範囲内の自律調整に限定し、spec・スコープの変更は既存の Discovery→PO承認フローを通す（PO判断）。Maker≠Checker は不変。
- `full-sdlc.md` の Stakeholders 節へ、FDE 投入時は代弁ペルソナより現場の一次情報を優先する旨の参照を追加した。

## [0.5.1] - 2026-07-07

既知の課題3件の是正、および独立レビュー指摘によるガード追加。

- `scripts/init-project.sh` の `TEMPLATE_VERSION` 生成を、複製元に `TEMPLATE_VERSION` があればそれを優先継承する方式に変更した。従来は複製元の `VERSION` を無条件にコピーしていたため、孫派生（親→子→孫）で子自身の semver が祖先テンプレ由来の値を上書きし、追跡が断絶していた。
- `.claude/skills/kiro-spec-batch/SKILL.md` に、任意の `## Waves` 節（`## Specs (dependency order)` の直前に置く、依存 wave を人間向けに明示する節）を正式定義した。spec-batch の解析対象ではなく人間とレビュアーの読み物である旨・配置位置・実例を明記した。M プリセットのパイロット走行で実行者が自己判断で追加せざるを得なかった状態を解消した。
- 上記 `## Waves` 節の規定に、見積もりの二重管理を防ぐ注意書きを追加した：見積もりの正本は `dashboard/status.json` の `milestones[].estimateH` であり、roadmap に見積もりを書く場合は独自の数値を作らず status.json の値を転記し、合計一致を明記する。
- `scripts/init-project.sh` の ROOT 算出直後・rsync 実行前に、`$ROOT/VERSION` と `$ROOT/CLAUDE.md` の存在確認ガードを追加した。いずれか欠如時はリポジトリ外への単体コピー実行を疑うエラーメッセージを出して停止する（実事故: ROOT誤解決で `$HOME` 全体を rsync しかけた）。

## [0.5.0] - 2026-07-06

知識置き場の再編。

- ルート直下に本ファイル（`CHANGELOG.md`）を新設し、`.claude/reports/` の日付レポート10本（2026-06-29〜2026-07-06）が持っていた恒久内容をバージョン履歴として集約した。
- 判断基準を正本へ追加反映した：着手前ガードのマーカーを機能の存在確認でなく直近コミット由来にする（`delegation.md`）、統括の受理手順にマージ前後の実描画スクリーンショット確認を明記する（`delegation.md`）、ビルド不能な中間コミット（bisect 不能点）を squash で main に持ち込まない（`orchestration.md`）。
- `.claude/reports/` の日付レポート10本を削除し、`reports/README.md` を新しい運用規約（恒久内容は書いた時点で正本へ・レポートはセッションメモとして随時削除可）へ書き換えた。
- レポート削除に伴い、`CLAUDE.md`・`README.md`・`.kiro/steering/orchestration.md`・`.claude/playbooks/template-feedback.md`・`.claude/playbooks/full-sdlc.md` の参照を更新した。

## [0.4.0] - 2026-07-06

ダッシュボード生成物の Git 管理除外と README の全面再構成。

- ダッシュボードのビルド生成物（`dashboard/*.html`・`dashboard/_astro/`・`dashboard/reports/`・`dashboard/steering/`）を Git 管理から除外した（`status.json`・`status.init.json` は管理を継続する）。
- pre-commit フックを「再ビルド＋生成物同梱」から「ステージされた `status.json`／`status.init.json` のスキーマ検証のみ」へ変更した。
- `scripts/verify-dashboard.mjs` からコミット整合チェック（生成物と Git 管理下の内容が一致することの確認）を撤去した。前提（生成物が Git 管理下にある）が失われたため。
- `scripts/init-project.sh` の rsync 除外に生成物パターンを追加した。
- README を初級〜中級エンジニア向けに全面再構成した（8節構成、Mermaid 図5枚を追加）。
- トレードオフ：クローン直後に `dashboard/status-dashboard.html` を `file://` で即閲覧できる利便性を失った。`npm install`＋`npm run build` が閲覧の前提になった。生成物の食い違い事故とリポジトリの差分ノイズを解消する対価として PO が受け入れた。
- （同日・是正）独立レビューの非ブロッキング指摘3件を是正した：NaN 誤検知文言・README の具体名記載・`verify` の表示順。

## [0.3.0] - 2026-07-05

初期状態ダッシュボードの同梱。

- 初期状態用ダッシュボードデータ `dashboard/status.init.json`（節目 M0 のみ・spec 空の汎用初期状態）を新設し、`scripts/init-project.sh` が複製・プレースホルダ置換の直後にこれを `status.json` として自動配置するようにした。派生のたびに手書きで初期状態へ差し替えていた手間（2 派生で 2 回実発生）を解消した。
- （同日・是正）初期状態の `estimateH:0` に由来する進捗率の NaN 表示を是正した（`derive.mjs` にゼロ除算ガードを追加し、名目値1を設定）。

## [0.2.0] - 2026-07-05

派生プロジェクトからの還流1件目（4件反映）。

派生プロジェクト `progress-digest`（TEMPLATE_VERSION 0.1.0 から派生）のパイロット走行で得た `TEMPLATE-FEEDBACK:` マーカー4件を反映した。

- `.kiro/settings/templates/`（`specs/`・`steering/`・`steering-custom/` 配下16ファイル）を同梱した。`kiro-spec-init` 等が参照するテンプレ群が本体に存在せず実行時に停止していた欠陥を解消した。
- `kiro-discovery` の `SKILL.md` へ `full-sdlc.md` のステークホルダー節・代弁ペルソナ割当への参照を追加した。
- `spec.json` の「生成済み・未承認」中間状態（`generated: true, approved: false`）が正式な中間状態であることを明文化した。
- `scripts/init-project.sh` の `git init` を既定ブランチ `main` 固定に修正した（`git init -q -b main`）。テンプレの手順・playbook が `main` を前提としているため。

## [0.1.0] - 2026-07-04

初期リリース。プロジェクト発足（2026-06-29）からこのバージョン番号を導入するまでの構築内容を含む。

- ダッシュボード生成基盤を導入した（`docs/status.json` ＋テンプレート→生成スクリプトによる静的 HTML 生成）。検証状態モデル（`evidence: string[]` ＝自動テスト／実機目視／実 API 疎通／PO 判断）を節目・spec 表に追加した。
- 非 worktree 委譲での無断コミット・push 事故（2026-07-02）を是正した。委譲プロンプトへ貼る禁止事項の逐語ブロックを `delegation.md` §0 に常設した。
- ダッシュボードを Astro（静的サイト生成ツール）へ全面移行した：`.astro` コンポーネント・`.mdx` ナラティブ・Mermaid 図・zod 検証・Tailwind ビルド時コンパイル。
- デザインリファイン案A（Indigo / Cool Slate）を適用した。WCAG AA 未達（`badge-ok` 4.095:1）を是正した。
- SSG 比較検証（Astro 7 vs 11ty／Nunjucks／Hugo／Nue／旧ゼロ依存実装）の結論として Astro 継続を採用した。品質指標（file:// 直開き・決定性・標準変更の追従容易性）は軽量系と同水準だったが、移行による実益が確認されなかったため。
- Astro 7 へ移行した（5.18.2→7.0.6、Tailwind v4 化）。検証ハーネス `scripts/verify-dashboard.mjs`（`npm run verify`）と pre-commit フックで、ビルド入力とビルド生成物の整合を機械化した。
- Wave 1〜3 でダッシュボードをポータル化した：reports／steering の content collections 化、ボードフィルタ・用語集検索・ダークトグルのアイランド対話性を追加した。
- ダッシュボードを全幅化しレスポンシブ対応した（390/768/1440/2560px で実描画検証）。
- レイアウト v2 を適用した：概要ページの分離、報告の3層化（対会社→部内→チーム内）、最小フォント14px、favicon、レフトナビ、更新チップ化。
- 日本語技術文書の文章規範（`.kiro/steering/writing-standards.md`）を新設した。
- S プリセット（`progress-digest`）・M プリセット（`ticket-ledger`）のパイロット検証を実施し、Discovery からレビュー受理までの SDLC 1周が完走することを確認した。
