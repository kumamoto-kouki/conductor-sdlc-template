# 2026-07-05 テンプレート還流1件目：progress-digest パイロットの提案4件を反映

`.claude/reports/2026-07-05-pilot-progress-digest.md` に記録された、派生プロジェクト `/var/syslabo/progress-digest`（TEMPLATE_VERSION 0.1.0 から派生）からの `TEMPLATE-FEEDBACK:` 4件を、PO承認のもとテンプレ本体へ反映した。`template-feedback.md` の還流手順（収集→取捨→反映→記録）の「反映」「記録」段にあたる。

## 反映した4件

### 1. `.kiro/settings/templates/` の同梱（欠陥）

progress-digest での `/kiro-spec-init` 実行時、テンプレが参照するファイル群が本体に存在せず「エラー報告して停止」以外の道がなかった。全 `kiro-*` スキルを grep し、`.kiro/settings/templates/` 配下への参照を棚卸しした結果、`specs/`（init.json・requirements-init.md・requirements.md・design.md・research.md・tasks.md）と、`kiro-steering` が参照する `steering/`（product.md・tech.md・structure.md）、`kiro-steering-custom` が参照する `steering-custom/`（api-standards.md・testing.md・security.md・database.md・error-handling.md・authentication.md・deployment.md）の3ディレクトリ・16ファイルが対象だった。各スキル本文（EARS規約・設計原則・タスク形式・steering granularity 原則）と整合する書式スケルトンとして作成した。スキル本文が英語のため、テンプレートも英語の骨組みとし、本文言語は `spec.json.language` に従う注記を添えた（`CLAUDE.md` の既存方針と同じ）。`scripts/init-project.sh` は複製先へリポジトリ全体を rsync するため、この同梱により以後の派生プロジェクトすべてに配布される。

### 2. `kiro-discovery` → `full-sdlc.md` の相互参照欠落（改善）

`brief.md` の `## Stakeholders` 追加可・代弁ペルソナ割当・`role-catalog.md` の誤用ガードは `full-sdlc.md` にのみ記述され、`kiro-discovery/SKILL.md` から辿れなかった。`SKILL.md` の brief.md テンプレート提示直後に2行の参照を追加した。

### 3. spec.json の「生成済み・未承認」中間状態の明文化（改善)

委譲エージェントによる一括生成（`kiro-spec-quick` の自動モードなど）が完了した直後の spec.json は、各フェーズが `generated: true, approved: false` になる。この状態はエラーではなく、人間または統括が事後に承認を記録するまでの正式な中間状態である。`kiro-spec-init/SKILL.md` と `kiro-spec-quick/SKILL.md` にこの意味を明記し、①で作成した `init.json` にも `generated`/`approved` 両フラグを持つ形（初期値はいずれも `false`）を反映した。

### 4. `init-project.sh` の既定ブランチ（欠陥）

`git init` が既定ブランチ `master` を作るため、`main` を前提とするテンプレの手順・playbooks と食い違っていた。`git init -q -b main` に変更した。リポジトリ内を grep した限り、他に `master` を前提とするコード上の記述はない（過去の振り返りレポート内の記述のみで、実行に影響しない）。

## なぜ反映したか

4件とも `template-feedback.md` の判断基準（「派生プロジェクト固有」でなく「テンプレ自体の構造」に関わる）を満たす。1と4は実行時に停止・既定ブランチ相違という形で実害が出ており欠陥、2と3は運用時の参照性・状態の意味を補う改善。

## 検証

- `/kiro-spec-init` の手順を新テンプレートで手動トレースし、以前「エラー報告して停止」だった6ファイル読み込みが全て解決することを確認した。
- 修正版 `init-project.sh` で一時ディレクトリへ派生し、複製先のデフォルトブランチが `main` であることを確認後、テストディレクトリを削除した。
- `bash -n scripts/init-project.sh` で構文を確認した。
- `npm run verify` を実行し、ダッシュボード再生成（本レポート追加分を含む）を確認した。

## 残る懸念

- `.kiro/settings/templates/steering-custom/` の7テンプレートは骨組みのみで、実際の派生プロジェクトでの使用実績（ドッグフーディング）はまだない。次にこれらを使う spec で内容の妥当性を確認する。

## 追記（同日・progress-digest での再検証結果）

v0.2.0 の更新を progress-digest へ取り込み（テンプレ更新取り込み運用の初実走）、1周目と同じ操作の再実行で4件すべての閉塞を確認した：G1＝kiro-spec-init がテンプレート読込を通過しダミー spec を完走生成、G2＝スキルの参照から full-sdlc.md の該当節へ実際に到達、G3＝中間状態の規定が1周目の実運用（一括生成→統括の事後承認）をカバー、G4＝派生プロジェクトの main 化に加え孫派生でも main。回帰はテスト14本全緑・verify 全✅。

再検証中に新規の欠陥1件（孫派生時に `TEMPLATE_VERSION` へ親自身の semver が書かれ、テンプレ由来バージョンの追跡が途切れる）を発見し、派生側の振り返りへ `TEMPLATE-FEEDBACK:` マーカーで記録した。次回の還流収集で反映可否を判断する。

## 追記（同日・初期状態ダッシュボードの同梱、PO直接指示による反映）

progress-digest・ticket-ledger の2派生で、テンプレの例データ入り `dashboard/status.json` を統括が毎回手書きで初期状態へ差し替える手間が2回実発生した。この手間は `TEMPLATE-FEEDBACK:` マーカー経由の収集を待たず、PO の直接指示で反映した（playbook手順4「反映したら VERSION を上げ、何を・なぜ反映したかを記録する」に準拠。手順2の取捨判断は PO の直接指示がその場を代替する）。`dashboard/status.init.json`（節目M0のみ・specs空の汎用初期状態、zod スキーマ検証済み）を新設し、`scripts/init-project.sh` が複製・プレースホルダ置換の直後にこれを `dashboard/status.json` として配置する（`.init` ファイルは複製先に残らない）よう改修した。テンプレ本体の `dashboard/status.json` は見本用サンプルデータのまま変更していない。VERSION は 0.2.0→0.3.0（機能追加のためMINOR）。
