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

- 非エンジニアの PO による実走（2026-08-23）で判明した欠陥と知見を反映した。テンプレートから生成したプロジェクトで導入から仕様確定まで通したところ、**テンプレート本体では通るが生成プロジェクトでは通らない**検証欠陥が2件見つかった。いずれも生成プロジェクト側での `npm run verify` 実行が今回初めてだったために露出していなかったもの。(1) `scripts/init-project.sh` が `package-lock.json` を複製対象から除外するため生成プロジェクトは `astro ^7.0.0` をその時点の最新へ解決する。テンプレート本体は 7.0.6 固定だが生成側は 7.2.4 を引き、7.2 系の `astro preview` はデーモンとして起動して即座に exit 0 するため、前景常駐を前提にログ行を待つチェック 2a が失敗し、かつデーモンが毎回残った。(2) チェック9（`.gitignore` ⇔ `template.gitignore`）は `init-project.sh` が複製時に `template.gitignore` を `.gitignore` へ改名するため、生成プロジェクトに対象ファイルが存在せず必ず失敗した。是正にあたり `astro preview` への依存自体を廃止した——独立レビューが、修正案（バージョン差をロックファイルの実在で吸収する方式）にも**利用者が `npm run serve` で起動したダッシュボードを無警告で殺す**欠陥（7.2 系はプロジェクトあたり preview デーモンを1つしか許さず、`astro preview stop` が利用者のデーモンを止める。実測で再現）と、**固定ポートへの到達性ポーリングが古いビルドを配る孤児サーバーに対して偽合格する**経路（astro は strictPort でなく別ポートへ逃げるが、ポーリングは要求ポートを見続ける。旧実装はログ行から実ポートを読んでいたため、この修正はその保証を失っていた）を検出したため。チェック 2a は `dashboard/` を配信する使い捨ての静的サーバー（`listen(0)` で OS 採番）を検証ハーネス自身が立てる方式へ変更し、共有デーモンの奪取・ポート不一致・バージョン依存を構造的に解消した。旧実装（`astro preview` 経由）との判定一致は全15ページで実証済み（Maker とレビュアーが独立に再実行して IDENTICAL を確認）。副産物として、静的サーバーを同一プロセスに立てると chromium の `spawnSync` がイベントループを止めて自プロセスのサーバーが応答不能になる自己デッドロックを発見し、非同期 `spawn` 化で解消した。チェック9のスキップ判定は「対象ファイルの不在」ではなく `package.scaffold.json` の有無（`scripts/init-project.sh` 自身がテンプレート本体／派生の判別に使っている）で行う形にし、テンプレート本体で `template.gitignore` を誤削除した場合は fail する（従来案では静かにスキップされ、このチェックが防ぐはずだった事故が素通りした）。`scripts/serve-dashboard.sh` の停止案内、`.claude/rules/dashboard-verification.md` の検証基準（正本が実装から取り残されると `astro preview` へ戻す改変を正当化しかねないため理由つきで追従）、独立レビュー指摘によるガードも併せて追加した（HTTP ステータス200の明示確認——従来 `--dump-dom` は404本文もDOMとして返していた、`close` イベントでのDOM確定、ページ単位のエラー隔離——1ページの一過性エラーで2a全体が落ちない、タイムアウトSIGKILLと異常終了の文言分離、ディレクトリトラバーサル防御と realpath 未取得の限界の明記、`closeAllConnections` による確実なクローズ）。`.claude/playbooks/full-sdlc.md` の四半期の依存更新棚卸し（生成プロジェクト側での verify 通過確認を追加。原因は「lockfile を配らない＋キャレット範囲」という機構であり機械化が本筋である旨と、生成プロジェクトの CI 設定はテンプレート管理外のため今回は手動確認に留めた理由も記録）も併せて更新した。
- 承認済み事項を下流工程が独断で狭めないことを規律として明文化した。同一の実走で**同じ類型の誤りが階層を変えて2回発生した**ことによる：統括が PO の回答（特定の人だけが解除できる運用）を、既存の技術方針（認証機構を設けない）と両立しないと気づいた時点で PO へ差し戻さずに要件を切り下げ、PO が承認段階で自力で見抜いた。設計担当は承認済みの受入基準2件が両立しないことを、正本のどこにも存在しない限定（「禁止されるのは*取り消せない*削除である」）を加えて解消し、独立レビュアーが検出した。正本を `.kiro/steering/orchestration.md` に新節として置き（既存の権限境界＝外部公開・破壊的操作・課金・認証が扱う**外向き**の影響とは別の類型＝承認済み事項の**内向き**の切り下げであることを明示。既存の「コミュニケーション・ゲート」節の「前提の崩れ」トリガーとの関係も1文で示した）、`.claude/skills/kiro-review/SKILL.md` に検出項目（正本に無い限定・例外が追加されていないかを何と何で照合するか）、`.claude/skills/kiro-spec-requirements/rules/requirements-review-gate.md` に要件フェーズ固有の扱い（PO 回答の収集中に気づいた時点で起草を止め、衝突と選択肢を提示して PO の判断を待つ）を接続した。あわせて `.claude/skills/kiro-validate-design/rules/design-review.md` の Core Review Criteria にも項目を追加した——`kiro-review` はタスク完了後の照合であり、設計フェーズの GO/NO-GO ゲートが任意実行である以上、同種の切り下げが実装まで温存される経路が残るため。
- 非エンジニアの PO と対話する際の判断基準を `.claude/playbooks/po-communication.md` として新設した。実走で再現性のある観測が4件得られたことによる：(1) 同じ PO が技術の質問では身構え業務の質問には即答した（負荷は質問の難易度ではなく「自分が判断すべきかの判別」にかかる）、(2)「報告のみ」と「判断が要る」を分けて提示すると負荷が下がる、(3) レビュー結果は回数だけでなく差し戻し例を添える（数字だけでは「遅れている」としか伝わらない）、(4) 小分けの逐次質問が受け入れられる（ただし総量に上限がある。実測は6回・計14問）。**根拠は1回の実走・1人の PO・ペルソナによるシミュレーションであり、独立レビューで「観測された関連を因果として断定している」と差し戻したうえで、交絡（質問の中身も同時に変わっている）を明示し仮説として扱う形に改めた。**判断基準の一文は残し、留保は出典・考察の段落に限定している。`.claude/skills/kiro-onboard/SKILL.md` の Step 2（各問いで領域の帰属を明示）と `.claude/skills/kiro-discovery/SKILL.md`・`.claude/playbooks/tech-selection.md` から参照する。
- 規模プリセット（S/M/L）の選定を「暫定」として扱い、`/kiro-discovery` 完了直後に見直す導線を通した。実走で、導入時の聞き取りからは単一 spec 相当に見えて S を選んだ直後、discovery で2スペックに分割する規模と判明したことによる（PO 談：「中身の違い、実際どう作業が変わるんか分かっとらんのに選ばされとる。ハンドルは握らせてもらっとるけど地図は見えとらん」）。`kiro-onboard` の Step 4 は PO に選ばせる形を保ったまま「この時点の選択は暫定であり、規模を決める情報が揃うのは discovery の後」と伝え、`role-catalog.md` の `**決定日 / 次の見直し**` フィールドへ見直し時期を書き込む（会話上の約束だけでは、導入と `/kiro-discovery` が別セッションになったときに何も残らないため）。`kiro-discovery` の Step 8 は同フィールドに `kiro-discovery` の言及が含まれる場合のみ見直しを PO へ提示する。**判定は完全一致でなく部分一致とした**——体裁の変更で静かに壊れる結合を避けるため（実際に一度、両ファイルの表記が食い違った）。見直しの解除も `kiro-discovery` が担う：PO の回答後に同フィールドのみを既定の周期（`wave 境界・マイルストーン境界で見直す`）へ書き戻し、プリセット自体は PO が変更を選んだ場合のみ更新する。**解除を担う工程を置かなければ、見直し後もマーカーが残り、2本目以降の spec で `/kiro-discovery` を回すたびに同じ提示が繰り返される**（横断レビューで検出。`scripts/init-project.sh` は `**採用中プリセット**` 行しか戻さず、`kiro-steering` の Sync も同フィールドを対象外としており、解除する主体が存在しなかった）。解除後の値は `kiro-discovery` を含まないため、未オンボードのプロジェクト（フィールドが既定値のまま）と同じ判定で黙る。
- `.claude/skills/kiro-discovery/SKILL.md` の Step 4 に「この仕組みを日常的に操作するのは誰か。その人はこの場にいるか」を追加した。実走では決裁者への聞き取りだけで仕様を固め、**日常的に入力する担当者が一度も関与しなかった**（PO 自身が残存不安の筆頭に挙げた：「実際キーボード叩くんはあの子やからな。そこが一番の本番」）。決裁者と操作者が同一の場合は既存の問い1で覆われるため追加の追跡を行わない。別人で不在の場合のみ、代理回答である旨を `brief.md` の `## Problem` に記録し（`.claude/playbooks/full-sdlc.md` が単一のステークホルダー事実を同節へ回す既存基準に従い、新しい節を増やさない）、`role-catalog.md` のプロトペルソナ投入を検討する導線を置く。**規模プリセットを小さくすると利用者視点の役が真っ先に落ちる**構造は残っており、これは解消していない。
- `.claude/playbooks/tech-selection.md` §2 に「PO に諮る技術判断／エンジニアが決めてよい技術判断」の線引きを追加した（判断基準の正本は同節。実走で、PO の業務に影響しない選定まで諮ると非エンジニアには判断不能な問いになると分かったことによる）。既存の基準（PO の提案をそのまま採用せず推奨案と並べて判断を仰ぐ）は変えていない——追加したのは諮る対象の範囲であり、諮ると決めた場合の扱いではない。

- 規模プリセット（S/M/L）の記録先を `.kiro/steering/role-catalog.md`「配役表（現状）」冒頭の**採用中プリセット**行として新設し、`scripts/init-project.sh` が複製時にこの行を「未選択」へ戻すようにした。あわせて導線を記録先へ通した：README の手順2・全体フロー図（規模選択ノードを追加）・体制図の注記（図は M プリセット）、`init-project.sh` の完了メッセージ、`.claude/skills/kiro-steering/SKILL.md`（Bootstrap で未選択なら S/M/L を提案・Sync で採用中プリセットの drift を Warning 報告。いずれも値は書き込まず PO が決める）、`.claude/playbooks/full-sdlc.md` の steering 陳腐化点検。配役表直下に 状態 の語彙（`未配役` を追加）と「プリセットを小さくしても行は削除しない」旨を明記した（役割名は `src/data/personas.json` と機械照合されるため、行を消すと `npm run verify` のチェック6 が落ちる）。
- WIP 上限の正本を `.kiro/steering/operations.md` に一本化した。`role-catalog.md` のプリセット表から「WIP 上限」列を削除して `operations.md` への参照に置き換え、`operations.md` 側は「既定 3。S プリセット採用時は 1〜2 に下げる」と記述して S の例外を反映した（従来は role-catalog が S=1〜2、operations が無条件で 3 と書き、どちらが優先か文書上未解決だった）。
- `src/content/team-structure.mdx` から元プロジェクト由来のハードコード文言（「▶ 現在のフェーズ：③ 実装…M1（非アクティブ編集の一覧更新）」）を汎用文へ置き換え、`phaseTrees` の `current: true` を全 false にした。`init-project.sh` の置換対象は `（プロジェクト名）` のみのため、この文言は派生プロジェクトのダッシュボードにそのまま残っていた。`current` フィールドと強調表示ロジック自体は任意の演出として残す。あわせて `dashboard/status.json` の signal 文言から WIP の数値を落とした。
- `CLAUDE.md` を日本語化した。指示内容は変えず、コマンド名・パス・フラグ・ツール名・モデル名は原文表記のまま残した。
- README の「中身の地図」を現状のツリーへ更新した。追加後に未反映だった要素（`writing-standards.md`／`.claude/rules/` の実ルール4件／`discovery-personas.md`・`swarm-multiprocess.md`／`bin/create.mjs`・`package.scaffold.json`・`TEMPLATE_VERSION`／`_wt-status.sh`／`.githooks/pre-commit`／`format-on-edit.mjs`／ダッシュボードの4ページ）を追記し、npm スクリプト一覧（dev/build/preview/serve/verify）を添えた。「経緯・注意」は現行バージョン（v0.10.0）を明示し、手順に直結する v0.4.0（生成物の Git 管理外化）と v0.10.0（`npx` 導線）だけを抜粋する形へ整理した。
- README 冒頭の由来記述にあったプレースホルダ「（プロジェクト名）」を実際の由来（Tauri デスクトップアプリ）へ置き換えた。`scripts/init-project.sh` は複製時にこのプレースホルダを新プロジェクト名へ一括置換するため、派生プロジェクトの README で「実プロジェクト（＜自分の名前＞）で確立した手法」という誤った文になっていた。
- README 再構成で消えた節を指していた相互参照を更新した：`scripts/init-project.sh` の完了メッセージと `.kiro/steering/role-catalog.md` の「規模別プリセット」前置きが、いずれも撤去済みの「README.md の『始め方』起動チェックリスト」を参照していたため「インストール後にすること」へ差し替えた。
- README の `npx` インストール例を、既定でバージョン固定なし（常に `main` 追従）に変更した。バージョン固定（`#v<tag>`）は再現性が必要な場合の任意手段に格下げし、タグ push が前提である旨を明記した。
- README を「アクション先行」に再構成した。冒頭のプロジェクト説明の直下へ、要点だけに絞った「すぐに始める」（前提の Node/npm バージョン＋npx 生成〜preview の5コマンド＋成功の目安）と「インストール後にすること」（ステアリング記入→規模/配役→最初の機能→進捗反映の4ステップ）を移動した。旧「5分で始める」「始める前のチェックリスト」を統合・撤去。失敗切り分けは折りたたみ（`<details>`）に最小限で収め、バージョン固定の説明は削除した。
- README のダッシュボード閲覧導線を修正・明記した。`build.format: "file"` でトップページ（root `/`）が無いため、`npm run preview` の URL 末尾に `/status-dashboard` を付けて開く旨と、他ページ（`/overview`・`/reports`・`/steering`）への画面内ナビを追記した（従来の「`http://localhost:4321/` を開く」は 404 になる不正確な記述だった）。
- `npx` インストール失敗時のメッセージを明示化した。`scripts/init-project.sh` に必須コマンド（rsync/git/sed/grep）の事前チェックと、複製先ディレクトリ作成失敗（親ディレクトリの書き込み権限なし＝root 所有配下を一般ユーザーで指定した場合など）の原因・対処メッセージを追加。`bin/create.mjs` は下位スクリプトが非0終了したとき、失敗の事実とよくある原因・対処の一覧を明示するようにした。README に失敗切り分け（うまくいかないとき）の節を追加し、npm 側で起きる `could not determine executable to run`（npm が古い）／認証要求・404（private リポジトリ）も含めて明文化した。
- 常時ロードされる `.kiro/steering/*.md` から陳腐化した参照（実在しない `.orchestration/STATE.md`、`tech.md` に残っていたスタック固有コマンド例、`src-tauri/` 固有パス、commit trailer に固定書きされたモデル名）を除去し、`orchestration.md`／`role-catalog.md` 内で二重化していた表・前置き・列挙を削って正本への参照に置き換えた（誤情報の除去と正本判断コストの低減が目的で、削減量自体は目的ではない）。
- 特定パスに触れた時だけ要る条件付きコンテンツを lazy 側へ移設した：`orchestration.md` の「振り返りの運用」節を `.claude/rules/retrospective.md`（`.claude/reports/**` 発火）へ、「可視化：真マルチプロセス swarm」節と `role-catalog.md` の代弁ペルソナ運用詳細・FDE charter を `.claude/playbooks/swarm-multiprocess.md`／`discovery-personas.md` へ移し、移動元にはポインタを残して `full-sdlc.md`・`kiro-discovery/SKILL.md` の参照先も更新した。「ループエンジニアリング」節は `src/content/autonomy-tiers.mdx` と重複する一般論を削り、段階的自律と停止条件のみに圧縮した。
- 技術選定の判断基準を新設した（監査で3件のギャップを検出：選定根拠が承認対象の `design.md` に載らない／プロジェクト初期のスタック選定に決め方が無い／責務と受理ゲートに技術選定の観点が無い）。正本 `.claude/playbooks/tech-selection.md` を新規作成し、①最新版でなく最新の安定版を選ぶ（周辺依存の追随を確認してから採用。TS7 移行検討時の実例つき）、②PO から採用技術の提案があってもそのまま採用せず、推奨案と並べて判断を仰ぐ（PO が再指示したらそれが決定）、の2基準を記録した。`.kiro/settings/templates/specs/design.md` §4 Architecture 配下に `### Technology Selection` サブセクション（節番号は不変。見出しは他の構造ラベルと同じ英語で固定し、受理ゲート側は文字列一致でなく構造的位置で判定する）、`.kiro/steering/tech.md`「スタック」節と `.kiro/steering/role-catalog.md`「🧭 設計（アーキテクト）」役割セル・`src/data/personas.json` の対応エントリにポインタを追加し、`kiro-validate-design/rules/design-review.md`（Core Review Criteria に §5 追加、Non-Goals の「finalize technology choices」は維持）・`kiro-spec-design/rules/design-review-gate.md`（Mechanical Checks に1項目追加）・`kiro-spec-design/rules/design-synthesis.md`（Build vs. Adopt からの参照）・`kiro-discovery/SKILL.md`（実現性検証からの参照）を接続した。
- モデル選定を工程として明示化した（PO 要求：①選定工程の追加 ②モデル特性への思考の適合 ③コストパフォーマンス採用 ④ダッシュボードでの可視化。従来は `CLAUDE.md` の委譲時判断基準のみで成果物に残らず①④が未達だった）。正本 `.claude/playbooks/model-assignment.md` を新規作成し、価格表を根拠にした階層別コストパフォーマンス判断・`effort` 指定可否の2経路（セッション/Workflow の `agent()` は `effort` を段階指定・`Agent` ツール委譲は `effort` 非対応のためプロンプトの書き方でモデル既定に適合）・記録の義務を記した。役割固定表は作らない（v0.9.0 の「役割でなくタスク形状で決める」決定と両立させるため、記録するのは規定でなく実績）。`.kiro/settings/templates/specs/tasks.md` に任意注釈 `_Model:_` を追加し `kiro-spec-tasks/rules/tasks-generation.md` に判断基準への参照を接続、`CLAUDE.md`「委譲の階層」行を詳細参照へ簡約（常時ロード行数は不変）。ダッシュボードは `dashboard/status.json` にトップレベル `modelUsage`（`entries[].role` は `personas.json` の役割名と一致・`scripts/verify-dashboard.mjs` チェック7で機械照合、無指定でも既存データを壊さないよう optional）を追加し、`src/components/ModelUsageTable.astro`（`SpecsTable.astro` を踏襲）と `status-dashboard.astro` の `#model-usage` 節（`data.modelUsage` が無ければ描画しない）で「どの工程・どのロールで実際に何を使ったか」を可視化した。`.kiro/steering/operations.md` の定期点検対象に `modelUsage` の実態確認を追加した。
- 非エンジニアの PO でも AI が対話で誘導するだけで初回導入を終えられるよう、新規スキル `.claude/skills/kiro-onboard/SKILL.md` を追加した（PO 指摘：このテンプレートの利用者は非エンジニアを想定しているのに、導入がユーザーへの手作業チェックリストで分かりづらい）。既存の導入担当は `kiro-steering` の Bootstrap のみだったが、これは既存コードベースの解析が前提で、生成直後のプロジェクトでは解析対象がテンプレート自身のダッシュボード実装（Astro/Mermaid/Tailwind/zod）になり、`tech.md` へ誤った技術構成が書き込まれる罠があった。加えて規模プリセットは「提案するが書かない」設計のため、ユーザーがファイルを開いて編集する手間が残っていた。`kiro-onboard` は Node/npm の確認・`npm install`・`npm run build` を AI が代行し、`AskUserQuestion` による専門用語なしの聞き取りから `product.md`／`tech.md`（技術が決まった場合のみ）／`role-catalog.md` の採用中プリセット行と配役表の 状態 列を AI が直接書き込む（配役表の行は削除しない。役割名は `npm run verify` のチェック6 で `personas.json` と機械照合されるため）。`structure.md` は**意図的に空のまま残す**——ディレクトリ構成・命名規約・設計上の不変条件を要求するが導入時点でコードが存在せず、汎用構成を書くとプロジェクト記憶に未検証の主張が入り以後の AI が決定事項として読むため。コードができてから `/kiro-steering` の Sync で埋める。最後に `npm run serve` でダッシュボードを開いて `/kiro-discovery` へ引き継ぐ。技術選定が「決まっていない」場合も `.claude/playbooks/tech-selection.md` に従い推奨案を提示したうえで、決まらなければ空欄のまま導入をブロックしない。役割選択自体は `AskUserQuestion` で PO から取るため、`kiro-steering` の「PO が決める・AI は書かない」原則とは矛盾しない（AI は決定の代行でなく記入の代行）。連動して `scripts/init-project.sh` の複製完了メッセージを「新フォルダを開く（VS Code／ターミナルの両方の手順）→ `/kiro-onboard` と入力する」の2手順に簡略化し（`npm install` 等の手順表記は削除。スキルが代行するため）、README の「すぐに始める」を `npx` 1行＋フォルダの開き方＋`/kiro-onboard` に、「インストール後にすること」の先頭を `/kiro-onboard` 案内に置き換えた（従来の4ステップ手順は `<details>`（手動で進める場合）へ温存し、エンジニアが手動で進める道は塞いでいない）。`CLAUDE.md`「最小ワークフロー」の先頭にも1行追記した。
- AI 向けドキュメントの棚卸しを定常化する仕組みを追加した（PO 要求：`.claude/` 配下や `CLAUDE.md` など AI が参照する文書の更新・削除・追加・最適化が一度きりでなく回り続けること）。既存の定期健全性チェックは `.claude/rules/` の GC と `.kiro/steering/` の陳腐化点検（実態との乖離）はカバーしていたが、`.claude/skills/`・`.claude/playbooks/`・`CLAUDE.md` は点検対象外で、かつ「モデル世代への適合」という軸とそのトリガーが無かった。`.claude/playbooks/full-sdlc.md`「定期健全性チェック」に「AI向けドキュメントのモデル世代適合点検」を追加し、対象範囲・`/claude-api prompt-audit` の利用（方法論は同梱skill側が正本）・モデル世代交代を最重要トリガーとすること・監査出力は提案であり事故由来の拘束（`orchestration.md` の規律A〜E・ベース是正ガード・権限境界・信用原則P1〜P6）は PO 承認なしに適用しないことを記した。あわせて `scripts/verify-dashboard.mjs` にチェック8（AI向けドキュメントのリポジトリ相対参照の実在検証）を追加し、`CLAUDE.md`・`.claude/` 配下・`.kiro/steering/` 配下の Markdown からリポジトリ相対と明確に分かる参照を抽出して実在を確認する（`.kiro/steering/roadmap.md` は `/kiro-discovery` の生成物で未生成が正常なため許可リストで除外）。棚卸しによる文書の移動・削除で、**フルパス表記の**参照がリンク切れになったときに機械で検知できるようにした。裸のファイル名参照（例: `` `orchestration.md` ``）は検知対象外——本コミット時点の実測で、検知対象のフルパス参照が 75 件（チェック8が実行のたびに走査件数として出力する値）なのに対し裸参照は 191 件あり、後者を対象に含めると spec 生成物（`design.md`・`tasks.md` 等）まで拾って誤検知が大量に出るため、曖昧さの無い参照だけを見る設計にした。件数は文書の増減で変わるため、引用するときは `npm run verify` の出力で取り直すこと。
- プロジェクトを終える工程が無かったため（`/kiro-onboard` で導入は工程化したが、終了は `full-sdlc.md` の「引き継ぎ」＝後任が続けるケースしか書かれておらず、このテンプレート自身の出自——元プロジェクトを保留してテンプレート化した——である「プロジェクト自体を終える」動線が言及ゼロだった）、新規スキル `.claude/skills/kiro-offboard/SKILL.md` を追加した。`AskUserQuestion` で完遂／保留／中止の3種を最初に聞き分け、以降の重点を変える。未コミットの変更・未統合ブランチ・残存 worktree・稼働中のプレビューサーバーは一覧で報告するのみで PO 承認なしに削除しない（`orchestration.md` の権限境界＝破壊的・不可逆操作は人間承認）。`.claude/reports/` の恒久化点検は `.claude/reports/README.md` の行き先対応表をそのまま使う（基準を再実装しない）。核心は `TEMPLATE-FEEDBACK:` マーカーの保全——`collect-template-feedback.sh` はテンプレート側から派生プロジェクトのパスを引数に実行する非対称な設計のため、派生側はマーカーを含むレポートを削除しないことが仕事になる。この非対称性を明示し、テンプレート側で打つコマンドを絶対パス入りで提示する。最終状態は `dashboard/status.json` を更新して `npm run build` を AI が実行し、クロージング記録は新形式を作らず `.claude/reports/YYYY-MM-DD-closing-<mode>.md`（`.claude/reports/README.md` の命名規約）として書く。保留時の再開手順は「### 3. 引き継ぎ」の handoff 項目をそのまま再利用し別立てしない。`full-sdlc.md` のフェーズマップに「終了」行を追加し、「### 3. 引き継ぎ」の直後に「引き継ぎ（後任が続ける）と終了（プロジェクト自体を終える）は別物」である旨の短い節を追加した。`CLAUDE.md`「最小ワークフロー」の末尾に1行追記した（常時ロード行数は最小限の増加）。
- npx 経由の複製で `.gitignore` が失われる不具合を修正した。PO 報告（環境構築後に `node_modules` が gitignore に入っていない）を発端に実測したところ、npm はパッキング時に `.gitignore` を tarball から常時除外することが判明した（`npm pack --dry-run --json` で143ファイル中に `.gitignore` が含まれないことを確認。`.claude/**` 等の他のドットファイルは含まれる）。この結果 `node_modules/`・`.astro/`・`dashboard/*.html`・`dashboard/_astro/`・`dashboard/reports/`・`dashboard/steering/` が派生プロジェクトで軒並み未追跡ファイルとして現れ、v0.4.0 で決めた「ビルド生成物を Git 管理外にする」が npx 経路で完全に無効化されていた。**訂正**: `CHANGELOG.md` [0.10.0] の備忘は「git-npx 経路（clone ベース）ではこれらは不要」と書いていたが、この想定は誤りだった。実際には git-npx 経路でも起きる。対処として、`.gitignore` と同一内容の `template.gitignore` をリポジトリ直下に新設した（この名前なら npm パッキングで除外されない）。`scripts/init-project.sh` は複製先で `template.gitignore` を `.gitignore` へリネームする処理を、既存の `status.init.json` → `status.json` 入れ替えと同じ流儀で・git 初期化より前に追加した（git 初期化後だと初回コミットに `node_modules` 等が混入するため）。2ファイルは同一内容でなければならない双子のため、`.claude/rules/steering-consistency.md` の方針に従い `scripts/verify-dashboard.mjs` にチェック9（`.gitignore` ⇔ `template.gitignore` 内容一致）を追加した。

### 既知の課題

- 規模プリセットを小さくすると、利用者視点を代弁する役（`.kiro/steering/role-catalog.md` のプロトペルソナ）が真っ先に未配役になる。2026-08-23 の実走では、日常的に入力する担当者が一度も関与しないまま仕様が確定した（決裁者が全問に代理で回答）。`kiro-discovery` に「日常的に操作するのは誰か／その人はこの場にいるか」の問いを追加して**検知**はできるようにしたが、S プリセットで利用者視点の役をどう確保するかは未解決。
- `kiro-onboard` が `role-catalog.md` の `**決定日 / 次の見直し**` へ書き、`kiro-discovery` が読んで解除する、という2スキル間の結合に**機械的な drift チェックが無い**。部分一致判定にしたことで体裁変更には強くなったが、書き込み側が壊れた場合は「見直しの提示が出ない」という無言の失敗になり、誰も気づけない。`.claude/rules/steering-consistency.md` が求める drift チェックの対象だが、`role-catalog.md` は PO が自由に書き換えるファイルであり、想定書式の機械検証が過剰にならない形を設計できていない。
- 生成プロジェクト側での `npm run verify` 通過を、四半期の棚卸しという**手作業**で担保している。原因（`scripts/init-project.sh` が lockfile を配らず、キャレット範囲がその時点の最新を引く）は機構であり、機械化が本筋である。生成プロジェクトの CI 設定はテンプレート管理外のため今回は見送った。
- `verify` のチェック8は裸のファイル名参照を検知できない（フルパス表記のみ）。拡張するなら、spec 生成物（`design.md`・`requirements.md`・`tasks.md`・`spec.json`・`research.md`・`brief.md`）の許可リストを持たせたうえで、裸の名前を `.kiro/steering/` と `.claude/**` から一意解決できるかで判定する方式が候補。誤検知が出ると無視されるチェックになるため、拡張時は必ず実データで誤検知件数を測ってから入れる。
- ダッシュボードのフェーズ強調（`team-structure.mdx` の `phaseTrees[].current`）を `status.json` 由来にする案は未着手（`src/lib/schema.mjs` のスキーマ拡張が必要）。現状は各プロジェクトが mdx を手編集する。
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
