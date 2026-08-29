# worktree-strategy.md — 並行実装のための worktree 運用

> **ここは常時ロードされない。**実装フェーズで worktree を使うときに読む。
> 判断基準の正本は `.kiro/steering/orchestration.md`（規律 A〜E・権限境界）で、そちらは常時ロードされる。
> このファイルはその適用先——**実装を並行させるときの具体的な運用**だけを持つ。

## worktree 戦略（実装フェーズ）

- feature ごとに worktree を分ける。`Agent` の `isolation:"worktree"`（自動）または手動 `git worktree add ../wt-<feature> -b feat/<feature>`。
- 各ワーカーは自 worktree のブランチ `feat/<feature>` で作業し、`src/` 等の共有ファイル衝突を物理的に回避する。
- **マージ／撤去のタイミング**：状態遷移に揃える。
  - **マージ先＝統合ブランチ（現 `<統合ブランチ>`）**。`main` はリリース/既定ブランチで、**`main` への反映＝push/merge は PO**（公開判断）。worktree の `feat/<feature>` は **2段階**で流れる：① `feat/<feature>` → 統合ブランチ（受理時）、② 統合ブランチ → `main`（リリース時・PO）。
  - **マージのタイミング＝「受理（独立レビュー PASS）→ ✅完了」の遷移**。ここでの「完了」は受理後を指す（実装完了≠受理。ボードの ✅完了・受理と同義）。
  - **マージの場所／主体＝メイン作業ディレクトリ（統合ブランチをチェックアウト中）で統括が実施**。マージ直後に **worktree とブランチを撤去**（`git worktree remove` ＋ merge 済みブランチを `git branch -d`）。テスト本数で二重カウントが無いことを確認する（コマンドは `tech.md`「コマンド（検証の要）」が正本）。
  - **破棄（古ベース等で実装を捨てる）も即撤去**：worktree を撤去し、理由を完了報告／`.orchestration/progress.log` に開示（黙って消さない）。
  - **運用が「滞留 worktree」を監視**：受理も破棄もされず残る worktree／merge 済みなのに撤去されないブランチ（例: 過去の `feat/機能D` 残置）を開示の健全性で拾う。
- **委譲 worktree は `.gitignore` に `.claude/worktrees/` を入れて追跡しない**。統合時は `git add -A` を避け**対象ファイルを明示 add**する（A3 で `git add -A` が worktree ディレクトリを埋め込みリポジトリとして誤取り込みした。untrack＋gitignore で是正）。
- **同一ファイルを編集する feature は同 wave に入れない**。spec フェーズは `.kiro/specs/<feature>/` がディレクトリ分離されるため worktree 不要。
- 委譲プロンプトの雛形（起動時 pwd 確認・起点ブランチ明示・commit 境界・完了報告の必須項目）は `.claude/playbooks/delegation.md` が正本。ここには判断基準のみ置く。
- **worktree の起点ブランチは明示し、ベース是正ガードを必須にせよ**：`Agent` の `isolation:"worktree"` はコンダクターの現在ブランチを自動で引き継がず、別ベース（リポジトリ既定など）から worktree を作ることがある——実際に古いベースから作られた worktree でそのまま実装→致命的競合で破棄になった事故が複数回ある（A2 UI第2弾ほか）。「対象ファイルの存在確認」型のマーカーだけでは古いベースでも偶然合格する偽陽性が起きた（2026-07-05・全幅化 Maker）ため、判定は「機能の存在確認」でなく「直近コミット由来」（`git merge-base --is-ancestor`）で行う。委譲プロンプトには「`<作業ブランチ>` を起点に `feat/<feature>` を作って作業せよ」の明示と着手前ガードを必ず入れる。**ガードの手順（検証コマンド・`git merge` による是正・`git reset --hard` 禁止・完了報告の証跡）の正本は `.claude/playbooks/delegation.md` の「着手前ガード（必須・省略不可）」雛形**、判断基準の正本は `orchestration.md`（P1・P4）——ここに手順を再掲しない。テスト**合計本数**が現行を下回ったら古いベースを疑う。
- **エージェントに権限/設定ファイル（`.claude/settings.json` 等）を触らせない**：deny は意図的な安全ガード。緩める必要が出たら**コンダクター/人間が判断**する。委譲プロンプトで「`.claude/**` の設定・権限ファイルは変更しない」と明示し、混入したら統合時に差し戻す（A2 で reset--hard の allow 化を差し戻した）。
- **委譲中、コンダクターはメインの working dir でアプリコードをコミットしない**：isolation が効かずエージェントがメインで作業しブランチを切替えた事故があり、コンダクターのコミットが feature ブランチに混入した（A 初回）。委譲中の並行作業は**別ファイル**に限定し、迷えばエージェント完了・統合後に行う。
