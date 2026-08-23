#!/usr/bin/env bash
# ダッシュボードの正式な閲覧方法（http配信）を起動する。
#
#   使い方: bash scripts/serve-dashboard.sh [ポート番号]
#           npm run serve でも同じ（package.json 参照）
#
# なぜ必要か: PO決定（2026-07-04）により、ダッシュボードの正式な閲覧方式を
# 「Webサーバー経由」に変更した（.claude/rules/dashboard-verification.md 参照）。
# file:// 直開きは「コア表示のフォールバック」に格下げし、その代償として
# 解禁した Mermaid の ESM 遅延読込は http 配信時のみ機能する（type="module" は
# file:// オリジンからのロードが CORS でブロックされるため）。
#
# 中身は Astro 標準の `astro preview`（追加依存ゼロ）を薄くラップしているだけ。
# 既定ポート 4321 が使用中の場合は Astro 自身が空きポートへ自動フォールバックし、
# 実際に使われた URL をログへ出力する（本スクリプトはそれをそのまま表示する）。
#
# 事前に `npm run build` で dashboard/ を最新化しておくこと（このスクリプトは
# ビルドは行わない＝ビルドタイミングを暗黙にしない）。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f "dashboard/status-dashboard.html" ]; then
  echo "警告: dashboard/status-dashboard.html が見つかりません。先に 'npm run build' を実行してください。" >&2
fi

PORT="${1:-4321}"

echo "起動中: npm run preview（ポート希望値: ${PORT}。使用中の場合は Astro が別ポートへ自動フォールバックします）"
# Astro 7.2以降は preview をバックグラウンドデーモンとして起動できる。本スクリプトは
# テンプレート本体（package-lock.jsonでAstro 7.0.6に固定＝前景常駐が確定）と、
# scripts/init-project.shで複製された生成プロジェクトの両方に配布される。生成
# プロジェクト側は package-lock.json が複製から除外されるため、package.json の
# キャレット範囲（^7.0.0）でAstroが解決され、どちらのバージョンが入るかは利用者の
# 手元の初回 npm install まで確定しない。デーモン化した場合はこのコマンドが即座に
# 終了し、Ctrl+C を押す場面が来ないままサーバーだけ残る。本スクリプト単体では
# どちらの配布先で動いているか判別できないため、前景常駐・デーモン化の両方に
# 触れておく。
echo "終了するには Ctrl+C を押してください（このまま常駐する場合）。"
echo "バックグラウンドで起動した場合（このコマンドがすぐ終了した場合）は、プロジェクトルートで"
echo "'node_modules/.bin/astro preview stop'（停止）または 'node_modules/.bin/astro preview status'（状態確認）を実行してください。"
echo

# node_modules/.bin/astro を直接 exec する（npx 経由だと npx 層が SIGTERM を
# 孫プロセスへ転送せず、非対話的終了（CI・timeout 等）で astro preview が残留する
# ＝独立レビュー実測の指摘）。node_modules 不在時のみ npx にフォールバック。
if [ -x "node_modules/.bin/astro" ]; then
  exec node_modules/.bin/astro preview --port "$PORT"
else
  exec npx astro preview --port "$PORT"
fi
