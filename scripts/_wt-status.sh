#!/usr/bin/env bash
# worktree 一覧と各 worktree の git 変更状況を出力する、並行開発の観測ヘルパ。
# 参照元: .kiro/steering/orchestration.md の「観測」と .claude/playbooks/swarm-multiprocess.md。
# 工程の全体像は STATUS.md（`npm run status` が生成）側で見る。ここは作業中の生の状態だけを見る。
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

echo "### git worktrees"
git worktree list
echo
git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r w; do
  branch=$(git -C "$w" rev-parse --abbrev-ref HEAD 2>/dev/null)
  echo "== ${w}  [${branch}] =="
  git -C "$w" status -s
done
