# 2026-07-05 振り返り：Mプリセット検証（ticket-ledger）とテンプレ v0.3.0

前レポート（`2026-07-05-pilot-progress-digest.md`・`2026-07-05-template-feedback-pilot1.md`）以降のまとまり。PO の就寝指示による中断のため、簡潔版として書く。

## 何を実装したか

1. **還流4件の反映（v0.2.0）と progress-digest での再検証**：4ギャップ全 CLOSED。再検証中に新規1件（孫派生の TEMPLATE_VERSION 追跡断絶）を発見しマーカー記録
2. **Mプリセット検証プロジェクト ticket-ledger**（`/var/syslabo/ticket-ledger`）：**M1〜M4 全達成・全4spec完了・テスト81本全緑**。Discovery（roadmap＝wave依存）→ spec-batch（4spec・EARS計107基準）→ Wave1（db-core）→ Wave2（search＋import-export を **Maker並行→レビュー並行**）→ Wave3（web-ui を**デザインRev＋EngRev二重ゲート**）
3. **settings.json 全体最適化（PO指示）**：汚染36件除去・死んだスタックルールGC・allow 65件へ整理・マシン固有は settings.local.json へ分離。以後の再汚染はセッション中に3回捕捉・基線復元
4. **初期状態用ダッシュボード同梱（PO指示・v0.3.0）**：`dashboard/status.init.json` を新設し、init-project.sh が派生時に自動で status.json へ配置。手書き初期化（2派生で2回実発生）を解消

## 検証で立った数字（受理根拠）

- 検索性能：1万件で**実測最大6.9ms**（受理基準100msの1/14・レビュアー独立再測定8パターン×20回）
- CSV往復：1万件で0.5秒・dryRun前後のDB完全不変を負のテストで実証
- WCAG AA：13トークンペア全て4.72:1以上（デザインRev独立計算）
- 並行開発：Wave2の2Maker・2レビュアー同時進行で**書き込み境界の衝突ゼロ・統合コンフリクトゼロ**

## 詰まった点・繰り返した判断

- **二重ゲートが実バグを両翼で捕捉**：web-ui はデザインRev（範囲外ページで件数表示が自己矛盾＝実機で発見）と EngRev（毎リクエスト動的import+migrate の恒常コスト＝計測で指摘）が**それぞれ別の実問題**で REJECTED を出した。単ゲートならどちらかは通っていた。Mプリセットの二重ゲートはコストに見合う
- **レビュアーの「派生先で verify を回す」が Maker の盲点を突いた**：初期状態同梱は Maker のビルド確認（grep）を通ったが、レビュアーが派生先で verify を実行し **0÷0 由来の非数が進捗率表示へ漏れる**破損を発見。是正は derive.mjs のゼロ除算ガード（根本）＋名目値1（データ）の両建て
- **pre-commit フックの `^src/` トリガーが派生プロジェクトで実害**：アプリコードも src/ に住むため、無関係な Astro ビルドが発火し生成物汚染がコミットへ混入（Wave1で3回）。ticket-ledger 側はダッシュボード実入力への限定で是正済み。**テンプレ側の同修正は未反映＝次回還流**
- **settings.json のセッション汚染は構造問題**：許可プロンプト応答が委譲のたびに堆積する。最適化（広めの恒久 allow）で発生源を減らし、受理手順§5の基線復元で運用。「最適化コミット自身の承認がコミット対象に追記される」自己言及例も観測
- **開示ループが機能し続けた**：設計内矛盾（db-core）・設計外判断（search 3件・import-export 2件・web-ui 1件）を全Makerが自主開示し、レビュアーが独立判定。隠蔽ゼロ

## 次回への持ち越し

- **ticket-ledger**：PO受け入れ確認（`node src/seed.mjs` → `node src/server.mjs` → http://localhost:3300）・振り返り作成と `TEMPLATE-FEEDBACK:` マーカー記録 → 還流収集
- **テンプレ還流候補（未反映）**：①pre-commit トリガーの src/ 限定（ticket-ledger で実証済みの修正）②孫派生の TEMPLATE_VERSION 継承 ③roadmap.md の Wave 節の正式化 ④見積の roadmap/status.json 二重管理注意 ⑤worktree での Astro ビルド非決定性（BaseHead ハッシュ）
- 初期状態同梱の**形式的な再レビュー1巡は中断指示により省略**（閉塞証拠＝Checker手順の第三者再現で受理・progress.log に開示済み）。気になる場合は次回冒頭で再検証可能
- push は PO 随時運用（テンプレ・派生とも未 push 分あり）
