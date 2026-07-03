#!/usr/bin/env bash
# 派生プロジェクトの振り返り（.claude/reports/*.md）から TEMPLATE-FEEDBACK: 行を収集し、
# テンプレ側で PO が取捨選択できる形に整えて標準出力へまとめる。
#   使い方: scripts/collect-template-feedback.sh <派生プロジェクトのパス>
#
# 収集対象: <派生プロジェクトのパス>/.claude/reports/*.md 内の "TEMPLATE-FEEDBACK:" 行
#           （前後の文脈つきで抜粋）。あわせて派生元の TEMPLATE_VERSION（無ければ VERSION）も表示する。
# 反映判断・VERSION 更新・reports への記録は行わない（PO が手動で行う）。
# 手順の詳細は .claude/playbooks/template-feedback.md を参照。
set -euo pipefail

usage() {
  echo "usage: scripts/collect-template-feedback.sh <derived-project-path>" >&2
  exit 1
}

[ "$#" -ge 1 ] || usage
SRC="$1"

if [ ! -d "$SRC" ]; then
  echo "error: ディレクトリが見つかりません: $SRC" >&2
  exit 1
fi

CONTEXT_LINES=2
REPORTS_DIR="$SRC/.claude/reports"

echo "# TEMPLATE-FEEDBACK 収集結果"
echo ""
echo "- 派生プロジェクト: $SRC"

if [ -f "$SRC/TEMPLATE_VERSION" ]; then
  echo "- 派生元テンプレバージョン (TEMPLATE_VERSION): $(cat "$SRC/TEMPLATE_VERSION")"
elif [ -f "$SRC/VERSION" ]; then
  echo "- バージョンファイル (VERSION): $(cat "$SRC/VERSION")"
else
  echo "- 派生元テンプレバージョン: 不明（TEMPLATE_VERSION / VERSION が見つかりません）"
fi
echo ""

if [ ! -d "$REPORTS_DIR" ]; then
  echo "（$REPORTS_DIR が見つかりません。収集対象なし）"
  exit 0
fi

shopt -s nullglob
files=("$REPORTS_DIR"/*.md)

if [ "${#files[@]}" -eq 0 ]; then
  echo "（$REPORTS_DIR に .md ファイルがありません。収集対象なし）"
  exit 0
fi

found=0
for f in "${files[@]}"; do
  matches="$(grep -n "TEMPLATE-FEEDBACK:" "$f" || true)"
  [ -z "$matches" ] && continue
  found=1
  echo "## $(basename "$f")"
  echo ""
  while IFS=: read -r lineno _rest; do
    start=$((lineno - CONTEXT_LINES))
    [ "$start" -lt 1 ] && start=1
    end=$((lineno + CONTEXT_LINES))
    echo '```'
    sed -n "${start},${end}p" "$f"
    echo '```'
    echo ""
  done <<<"$matches"
done

if [ "$found" -eq 0 ]; then
  echo "（TEMPLATE-FEEDBACK: 行は見つかりませんでした）"
fi
