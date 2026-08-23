# swarm-multiprocess.md — 真マルチプロセス swarm 手順

`orchestration.md` の既定（subagent 方式）に対する非既定の可視化オプション。人間が「複数ウィンドウで各 AI が稼働している様子」を視認したい場合のみ使う。

## 可視化：真マルチプロセス swarm

人間が「複数ウィンドウで各 AI が稼働している様子」を視認できるようにする（真の並行は別セッション＝各 worktree で独立 claude プロセス）。

- `scripts/swarm-up.sh <feature>...` — 各 feature の worktree を作り tmux `project-swarm` の各ペインで**独立 worker claude**を起動（pane0=観測、pane1..N=ワーカー）。コンダクターは `tmux send-keys` でタスク投入、ワーカーは自 worktree で実装・コミット、結果は git/`progress.log` で確認・統合。人間は `tmux attach` で視認。`swarm-down.sh` で終了・worktree 撤去。
- 各 worker claude は**独立認証・独立コンテキスト・独立課金**（コスト効率重視は subagent 方式を選ぶ）。観測サマリは `scripts/_wt-status.sh`（worktree 一覧と各 worktree の git 変更状況）と `.orchestration/progress.log` の `tail -f`。
