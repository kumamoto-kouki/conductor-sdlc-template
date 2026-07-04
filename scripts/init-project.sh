#!/usr/bin/env bash
# テンプレート一式を新規プロジェクトディレクトリへ複製し、git初期化・プレースホルダ置換までを行う。
#   使い方: scripts/init-project.sh <target-dir> [project-name]
#
# 除外（ローカル専用・再生成される中間物のみコピーしない）:
#   .git / node_modules / .orchestration / .claude/worktrees /
#   .claude/settings.local.json / .astro / public/vendor
# 注意: dashboard/_astro と dashboard/vendor は除外しない。テンプレが git コミット済みの
# 配布資産であり、これを除外すると npm install 前のダッシュボード表示が CSS/mermaid
# 参照切れになる（独立レビュー指摘 F1）。
#
# [project-name] を指定すると、README.md 等の「（プロジェクト名）」プレースホルダを置換する。
# 複製先には VERSION の内容を TEMPLATE_VERSION として記録する（派生元バージョンの追跡。
# 詳細は .claude/playbooks/template-feedback.md を参照）。
set -euo pipefail

usage() {
  echo "usage: scripts/init-project.sh <target-dir> [project-name]" >&2
  exit 1
}

[ "$#" -ge 1 ] || usage
TARGET_ARG="$1"
PROJECT_NAME="${2:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -e "$TARGET_ARG" ]; then
  echo "error: 複製先が既に存在します: $TARGET_ARG（上書きは行いません）" >&2
  exit 1
fi

mkdir -p "$TARGET_ARG"
TARGET="$(cd "$TARGET_ARG" && pwd)"

echo "テンプレートを複製中: $ROOT -> $TARGET"
rsync -a \
  --exclude='.git' \
  --exclude='node_modules/' \
  --exclude='.orchestration/' \
  --exclude='.claude/worktrees/' \
  --exclude='.claude/settings.local.json' \
  --exclude='.astro/' \
  --exclude='public/vendor/' \
  "$ROOT"/ "$TARGET"/

# 派生元バージョンを記録（① テンプレへのフィードバック機構との連携）
if [ -f "$ROOT/VERSION" ]; then
  cp "$ROOT/VERSION" "$TARGET/TEMPLATE_VERSION"
else
  echo "warn: $ROOT/VERSION が見つかりません。TEMPLATE_VERSION は作成しません" >&2
fi

# プレースホルダ置換（実際の出現箇所: README.md / src/pages/status-dashboard.astro /
# dashboard/status-dashboard.html。dashboard/status-dashboard.html はビルド生成物だが、
# npm install 前でも複製直後から一貫した表示にするため直接置換する）
if [ -n "$PROJECT_NAME" ]; then
  echo "プレースホルダ（プロジェクト名）を置換中: $PROJECT_NAME"
  # sed の置換文字列として安全になるよう / と & をエスケープする
  esc_name="$(printf '%s' "$PROJECT_NAME" | sed -e 's/[\/&]/\\&/g')"
  for f in README.md src/pages/status-dashboard.astro dashboard/status-dashboard.html; do
    if [ -f "$TARGET/$f" ]; then
      sed -i "s/（プロジェクト名）/${esc_name}/g" "$TARGET/$f"
    fi
  done
fi

# git 初期化 + 初回コミット（user.name/email 未設定の環境でも失敗しないようフォールバックを渡す）
(
  cd "$TARGET"
  git init -q
  # dashboard/ の生成物とビルド入力の整合を機械化するpre-commitフックを有効化する
  # （.githooks/pre-commit 本体はテンプレに同梱。詳細は同ファイルのコメント参照）。
  git config core.hooksPath .githooks
  git add -A
  base_version="$(cat "$TARGET/TEMPLATE_VERSION" 2>/dev/null || echo unknown)"
  # 初回コミットは --no-verify で行う: この時点では npm install 前で node_modules が
  # 無く、pre-commit フック（ビルド実行）は必ず失敗する。テンプレ一式の複製コミットに
  # ビルド整合チェックは不要（生成物はテンプレ側でビルド済みのものをそのまま複製している）
  # ——独立レビュー指摘（初回コミットが100%ブロックされる回帰）の是正。
  git -c user.name="$(git config user.name 2>/dev/null || echo project-init)" \
    -c user.email="$(git config user.email 2>/dev/null || echo project-init@local)" \
    commit -q --no-verify -m "chore: initialize project from conductor-sdlc-template (base VERSION ${base_version})"
)

echo ""
echo "完了: $TARGET"
echo ""
echo "次にやること:"
echo "  1. cd \"$TARGET\""
echo "  2. npm install    # 初回のみ（Astro + Mermaid + Tailwind 等の依存取得）"
echo "  3. README.md の「始め方」起動チェックリストに従い、product.md / tech.md / structure.md を記入"
echo "  4. .kiro/steering/role-catalog.md の「規模別プリセット（S/M/L）」から今回の規模を選び、配役を確定"
