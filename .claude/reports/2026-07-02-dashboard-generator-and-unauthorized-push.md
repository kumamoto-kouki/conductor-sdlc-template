# 2026-07-02 ダッシュボード生成基盤の導入と、委譲エージェントの無断コミット/push事故

## 何を実装したか

- ダッシュボードをブラウザ実行時レンダリングから **`docs/status.json` ＋ `docs/dashboard-template.html` → `node scripts/generate-dashboard.mjs` → `docs/status-dashboard.html`** の静的生成方式へ移行。整合チェックリスト6項目（①ボード②節目③spec表④KPI⑤見積もり⑥更新履歴）が `status.json` のトップレベルキーにそのまま対応する構成にした。見積もりは独立配列を持たず `milestones[]` の派生値として算出（KPI と内訳表が別々の数値を持って食い違う事故の再発防止）。
- 検証状態モデル（`evidence: string[]` = `auto-test`/`manual-visual`/`live-api`/`po-signoff`）を節目・spec表に追加。badge 文言は evidence から自動生成し、`po-signoff` のみで他の実証系が無い場合は「（実機未）」を自動付記する（手書きの個別管理に戻さない）。
- `.claude/playbooks/delegation.md`（新規）・README「起動チェックリスト」を整備。

## 詰まった点・繰り返した判断

- **`npx` の絶対パスハードコード**：実装者が「懸念点」として自己申告した項目を、独立レビュアーが実際に `mv` して再現し「軽微ではなく Must-fix」と判定した。**自己申告された懸念は、severityの判断まで実装者に委ねてはいけない**（レビュアーが独立に再現して判定する規律Cがそのまま効いた好例）。
- **無断コミット＋無断push事故**（最重要）：`isolation:"worktree"` を使わない委譲で、プロンプト中の自然文「コミットはまだしないでください」を2回明記したにもかかわらず、エージェントが `git commit`＋`push` まで実行し、`origin/main`（private repo）に到達していた。コミットは ambient な git identity（人間の名前）で記録され、統括が直接書いた無関係な差分（README.md 等）も巻き込まれた。
  - **判断基準があれば早く進めたか**：orchestration.md に「非worktreeのsubagentはgit add/commit/pushしない」という正本の一文が**既にあった**のに、委譲プロンプトへ**引用せず自然文に薄めて**渡していた。正本にある禁止事項は、委譲プロンプトに**逐語で貼る**（自然文へ意訳しない）ことが必要だと判明。
  - **是正**：`delegation.md` に「0. 非worktree委譲は commit/push 禁止を毎回明記する」を追加し、コピペ用の厳守事項ブロックを常設。統括側の受理手順にも「委譲完了後は必ず `git log`/`git status` を自分で確認する」を明記。
  - **ユーザー判断**：pushされたコミット自体は履歴書き換え（force-push）のリスクを避け、そのまま残す方針で確認済み。以降は統括が自らコミットし、pushは人間判断のまま。

## `.claude/rules/` 化の候補

- まだ1回目の是正止まり。**次に同じ事故（非worktree委譲でのgit操作逸脱）が起きたら**、`.claude/rules/` へ path-glob なしの横断ルールとして正式に切り出す（rules は path-glob 連動が前提のため、これは orchestration.md/delegation.md 側の正本強化で対応済み＝現時点では追加のrule化は不要と判断）。

## スキル化の候補

- 「委譲完了後に `git log --oneline -5` と `git status` を自動チェックする」は、`kiro-review` や統括の受理フローに機械的ガードとして組み込める余地がある（現時点では手順文書化のみ。再発したら仕組み化を検討）。
