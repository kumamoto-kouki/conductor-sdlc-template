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

### 変更

- README の `npx` インストール例を、既定でバージョン固定なし（常に `main` 追従）に変更した。バージョン固定（`#v<tag>`）は再現性が必要な場合の任意手段に格下げし、タグ push が前提である旨を明記した。
- README を「アクション先行」に再構成した。冒頭のプロジェクト説明の直下へ「すぐに始める」（前提の Node/npm バージョン確認・npx 生成・ビルド・確認まで）と「インストール後にすること」（ステアリング記入→規模/配役→運用パラメータ→技術セットアップ確認→最初の機能の作り始め）を移動・充実化し、旧「5分で始める」「始める前のチェックリスト」を統合した。失敗切り分けは折りたたみ（`<details>`）に収めた。
- `npx` インストール失敗時のメッセージを明示化した。`scripts/init-project.sh` に必須コマンド（rsync/git/sed/grep）の事前チェックと、複製先ディレクトリ作成失敗（親ディレクトリの書き込み権限なし＝root 所有配下を一般ユーザーで指定した場合など）の原因・対処メッセージを追加。`bin/create.mjs` は下位スクリプトが非0終了したとき、失敗の事実とよくある原因・対処の一覧を明示するようにした。README に失敗切り分け（うまくいかないとき）の節を追加し、npm 側で起きる `could not determine executable to run`（npm が古い）／認証要求・404（private リポジトリ）も含めて明文化した。

### 既知の課題

- worktree 環境での Astro ビルドに非決定性がある（BaseHead ハッシュが実行ごとに変わる）。
- `scripts/verify-dashboard.mjs` の要素数チェックは `git show HEAD:<path>` で直前コミットの生成物と比較する設計だが、v0.4.0 でダッシュボードの生成物を Git 管理外にした副作用により、比較対象が常に「新規ページ」判定になり HEAD 比較が実質機能しない。

## [0.10.0] - 2026-07-13

パッケージマネージャー（`npx`）からの一発インストール導線を追加した。リポジトリを clone しなくても `npx github:kumamoto-kouki/conductor-sdlc-template#v0.10.0 <target> [name]` で新規プロジェクトを生成できる。

- `bin/create.mjs`（Node ESM の薄いラッパー）を追加し、`package.json` に `bin` を宣言した。複製・プレースホルダ置換・git 初期化ロジックの正本は従来どおり bash の `scripts/init-project.sh` に置き、ラッパーはこれを shell-out するだけ（ロジックの二重管理を避ける）。対象は Unix 系 / WSL（bash 前提）。
- `package.json` の2役の衝突を解消するため、マニフェストを分離した。ルート `package.json` を CLI マニフェストへ転用（`bin` 追加・Astro スタックを `dependencies` → `devDependencies` へ移動。これにより `npx github:` の依存取得が軽量化される。`private:true` は維持しレジストリ公開はしない）。複製先へ配るダッシュボード用マニフェストは新設の `package.scaffold.json` に保持し、`init-project.sh` が複製先で `package.json` として配置する。
- `scripts/init-project.sh` の rsync 除外に CLI 固有物（ルート `/package.json`・`/bin/`・`/package-lock.json`・`/package.scaffold.json`）を追加した。
- 備忘: 将来 npm レジストリへ公開する場合は、tarball から `.gitignore` が除去される等のパッキング対応（`template.gitignore` へのリネーム・`.npmignore` 追加・`files` ホワイトリスト・`LICENSE`）が別途必要。git-npx 経路（clone ベース）ではこれらは不要。

## [0.9.0] - 2026-07-09

Anthropic公式クックブック（coordinator/workerパターン）を踏まえ、委譲時のモデル選択方針を役割固定から見直した。

- `CLAUDE.md` の Token / Cost Efficiency 節に、モデル選択を「役割名」でなく「タスクの形状（機械的収集か判断力を要する統合か）」で決める判断基準を追加した。
- `.kiro/steering/orchestration.md` に、サブエージェント報告のうち後続判断の重みを支える事実主張は検証コストが安ければ統括が独立に1点検証してから受理する、という判断基準を追加した。

## [0.8.0] - 2026-07-08

3方向の監査で発見した7件の文書不整合を是正し、再発防止の drift 検知機構を追加した。根本原因は同じ事実を独立した文章で複数箇所に書いていたこと（Single Source of Truth 違反）に収束する。

- `orchestration.md` のベース是正ガード節を更新し、`git merge-base --is-ancestor` を主検証・`cat-file`/`grep` を補助検証に格上げ／格下げして `delegation.md` の現行手順と揃えた。あわせて規律(B)へ、統括の受理時スクリーンショット確認・`.claude/settings.json` 汚染チェックの判断基準を追加した。`delegation.md` 側は該当箇所の説明文を短縮し `orchestration.md` への参照に変えた。
- `team-structure.mdx` の `phaseTrees` に欠落していた「保守運用」フェーズの図を追加し、既存の Discovery／設計／実装／レビュー・受理の各図へ代弁ペルソナ・FDE のノードを反映した（`role-catalog.md` のフェーズ別投入計画表との不一致を解消）。全期間横断の脚注にステークホルダー代弁への言及も追加した。
- `kiro-discovery/SKILL.md` の代弁ペルソナ列挙を撤去し、`full-sdlc.md` の該当節への参照へ置き換えた（FDE 未言及の二重コピーを解消）。
- `personas.json` の代弁ペルソナ3件（エンドユーザー代弁・現場代弁・ステークホルダー代弁）の `role`/`desc` を、`role-catalog.md` の「仮説（プロトペルソナ）」再定義後の文言に合わせて更新した。
- `operations.md` の文書管理記述を「運用が管理する正本」から「運用が定期点検の対象として確認する文書」へ変更し、`review-checklists.md` の著者権を主張しない表現にした（`README.md` の所有記述との矛盾を解消）。
- `full-sdlc.md` のフェーズマップ表から役割列の個別列挙を削り、役割配置は `role-catalog.md` のフェーズ別投入計画表を正本とする参照に置き換えた。
- `scripts/verify-dashboard.mjs` に新しい検証（6. role-catalog.md ⇔ personas.json 役割整合）を追加した。`role-catalog.md` の配役表・候補ロスターの役割名一覧と `personas.json` の `name` 一覧を突き合わせ、片方だけに存在する役割があれば失敗として報告する。Markdown 表と JSON という本質的にフォーマットが異なる双子は参照だけでは同期を保てないため、機械チェックで drift を検知する。
- `.claude/rules/steering-consistency.md` を新設し、steering／playbook／skill 間の重複回避と drift 検知の判断基準を明文化した。

## [0.7.1] - 2026-07-08

- FDE（フォワードデプロイド）をダッシュボードの体制図・チーム名簿へ反映した（`src/data/personas.json`・`src/content/team-structure.mdx`）。他の候補ロール（設計・セキュリティ監査等）と同じ表示パターン（破線・「これから」バッジ）に揃え、体制図に FDE ノードと統括への提案フローを追加した。代弁ペルソナの需要側ノードのラベルも「要求・受け入れ観点の供給元」から「実在アクセスが無い時の仮説の供給元」へ更新し、記入優先順（実在アクセス→FDE→代弁ペルソナ）と整合させた。

## [0.7.0] - 2026-07-07

- FDE の charter に「現場情報は優先度の高い根拠であって無条件の正解ではない」旨の認識論的な注意書きを追加した（PO指摘：単一の接点からの解釈である可能性を常に開示し、矛盾はPOへ上申する）。
- 代弁ペルソナ（🙋/🏭/🤝）を「意見を述べる役」から「検証すべき仮説を明示する役」（プロトペルソナ）へ再定義した。使命（需要側の関心事が供給側の都合で押し流されるのを防ぐ）を明文化し、記入は断定でなく「未検証・根拠」つきの仮説形式に変更。ステークホルダー欄の記入優先順を「実在アクセス→FDE→代弁ペルソナ（仮説）」に整理した（`full-sdlc.md`）。

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
