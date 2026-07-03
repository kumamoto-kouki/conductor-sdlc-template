#!/usr/bin/env bash
# テンプレート一式を新規プロジェクトディレクトリへ複製し、git初期化・プレースホルダ置換までを行う。
#   使い方: scripts/init-project.sh <target-dir> [project-name]
#
# 除外（生成物・ローカル専用ディレクトリはコピーしない）:
#   .git / node_modules / .orchestration / .claude/worktrees /
#   dashboard/_astro / dashboard/vendor / public/vendor
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
  --exclude='dashboard/_astro/' \
  --exclude='dashboard/vendor/' \
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

# git 初期化 + 初回コミット
(
  cd "$TARGET"
  git init -q
  git add -A
  base_version="$(cat "$TARGET/TEMPLATE_VERSION" 2>/dev/null || echo unknown)"
  git commit -q -m "chore: initialize project from conductor-sdlc-template (base VERSION ${base_version})"
)

echo ""
echo "完了: $TARGET"
echo ""
echo "次にやること:"
echo "  1. cd \"$TARGET\""
echo "  2. npm install    # 初回のみ（Astro + Mermaid + Tailwind 等の依存取得）"
echo "  3. README.md の「始め方」起動チェックリストに従い、product.md / tech.md / structure.md を記入"
echo "  4. .kiro/steering/role-catalog.md の「規模別プリセット（S/M/L）」から今回の規模を選び、配役を確定"
