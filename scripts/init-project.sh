#!/usr/bin/env bash
# テンプレート一式を新規プロジェクトディレクトリへ複製し、git初期化・プレースホルダ置換までを行う。
#   使い方: scripts/init-project.sh <target-dir> [project-name]
#
# 除外（ローカル専用・再生成される中間物のみコピーしない）:
#   .git / node_modules / .orchestration / .claude/worktrees /
#   .claude/settings.local.json / .astro / public/vendor /
#   dashboard/*.html・dashboard/_astro/・dashboard/reports/・dashboard/steering/
# 加えて CLI 固有物も除外する: ルート /package.json（複製元のCLIマニフェスト）・/bin/（npx入口）・
#   /package-lock.json・/package.scaffold.json。複製先の package.json には package.scaffold.json
#   （ダッシュボード用マニフェストの正本）を配置する（詳細は下記の複製処理のコメント参照）。
# 注意: v0.4.0 で dashboard/ のビルド生成物を Git 管理外にした（.gitignore 参照）ため、
# 複製元にこれらが存在しても中間生成物でしかない。複製先では npm install + npm run build
# で作り直す前提に変わった（旧: 独立レビュー指摘 F1 により複製直後の file:// 表示のため
# 複製していたが、正式閲覧が npm run preview 経由に変わったこと・生成物がGit管理外に
# なったことでこの特例は不要になった）。
#
# [project-name] を指定すると、複製先ツリー全体を対象に「（プロジェクト名）」プレースホルダを
# 置換する。対象ファイルは固定せず複製後に grep で検出するため、ページ追加に追随する。
# scripts/init-project.sh 自身はこのプレースホルダ表記をコードとして持つため置換対象から外す。
# 複製先には TEMPLATE_VERSION を記録する（派生元バージョンの追跡。詳細は
# .claude/playbooks/template-feedback.md を参照）。複製元に TEMPLATE_VERSION があれば
# それを継承し、無ければ VERSION の内容を使う（孫派生でのテンプレ由来バージョン断絶を防止）。
# 複製先の dashboard/status.json は dashboard/status.init.json（汎用の初期状態）へ入れ替える。
# テンプレ本体側の status.json は見本用サンプルデータのまま変更しない。
set -euo pipefail

usage() {
  echo "usage: scripts/init-project.sh <target-dir> [project-name]" >&2
  exit 1
}

[ "$#" -ge 1 ] || usage
TARGET_ARG="$1"
PROJECT_NAME="${2:-}"

# 必須コマンドの事前チェック（欠けている場合は複製の途中で不明瞭に失敗するため、先に明示して止める）。
missing_tools=""
for tool in rsync git sed grep; do
  command -v "$tool" >/dev/null 2>&1 || missing_tools="${missing_tools} ${tool}"
done
if [ -n "$missing_tools" ]; then
  echo "error: 必須コマンドが見つかりません:${missing_tools}" >&2
  echo "       これらをインストールしてから再実行してください（例: Debian/Ubuntu なら 'sudo apt install rsync git' 等）。" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ガード: ROOTにVERSION/CLAUDE.mdが無ければ、本スクリプトがリポジトリ外へ単体コピーされて
# 実行された可能性を疑い停止する（実事故: ROOT誤解決で$HOME全体をrsyncしかけた）。
if [ ! -f "$ROOT/VERSION" ] || [ ! -f "$ROOT/CLAUDE.md" ]; then
  echo "error: $ROOT に VERSION または CLAUDE.md が見つかりません。scripts/init-project.sh をリポジトリ外へ単体コピーして実行していませんか？ conductor-sdlc-template リポジトリ内の scripts/ から実行してください" >&2
  exit 1
fi

if [ -e "$TARGET_ARG" ]; then
  echo "error: 複製先が既に存在します: $TARGET_ARG（上書きは行いません）" >&2
  echo "       別の新規パスを指定するか、既存ディレクトリを退避してから再実行してください。" >&2
  exit 1
fi

# 複製先ディレクトリを作成する。親ディレクトリに書き込み権限が無い場合（例: root 所有の
# /var/... 配下を kouki 権限で指定）は mkdir が Permission denied で失敗するため、素の
# bash エラーで終わらせず、原因と対処を明示して止める。
if ! mkdir -p "$TARGET_ARG" 2>/dev/null; then
  parent="$(dirname "$TARGET_ARG")"
  echo "error: 複製先ディレクトリを作成できませんでした: $TARGET_ARG" >&2
  if [ -e "$parent" ] && [ ! -w "$parent" ]; then
    echo "       親ディレクトリ '$parent' に書き込み権限がありません（所有者=$(stat -c '%U' "$parent" 2>/dev/null || echo '不明')）。" >&2
  else
    echo "       親ディレクトリを作成/書き込みできません（権限またはパスを確認してください）。" >&2
  fi
  echo "       対処: 書き込み可能なパス（例: ~/projects/<name>）を指定してください。" >&2
  exit 1
fi
TARGET="$(cd "$TARGET_ARG" && pwd)"

echo "テンプレートを複製中: $ROOT -> $TARGET"
# CLI 固有物（複製元を npx スキャフォルダとして機能させるための入口・ロック）は複製先へ運ばない。
# これらは複製元にしか無い or 複製先で作り直せるため、存在しなくても除外は無害な no-op。
#   /bin/              … npx スキャフォルダ入口（bin/create.mjs）。複製先には不要。
#   /package-lock.json … 複製元のロックファイル。複製先は自身の npm install で作り直す。
#   /package.scaffold.json … 複製先 package.json の中身（テンプレ本体のみ保持）。cp で明示配置する。
# 先頭 '/' 付き exclude は転送ルート直下のみに効く（配下の同名は対象外）。
#
# package.json の扱いは複製元の種別で分岐する:
#   - テンプレ本体（$ROOT/package.scaffold.json あり）: 複製元 root の package.json は CLI マニフェスト
#     （bin/devDependencies 入り）で複製先に不適切なため除外し、代わりに package.scaffold.json を
#     複製先の package.json として配置する。
#   - 派生プロジェクト（package.scaffold.json 無し・孫派生時）: root の package.json は既にダッシュボード用
#     マニフェストなので、そのまま複製する（除外も cp もしない）。これにより孫派生でも成立する。
pkg_excludes=( --exclude='/bin/' --exclude='/package-lock.json' --exclude='/package.scaffold.json' )
if [ -f "$ROOT/package.scaffold.json" ]; then
  pkg_excludes+=( --exclude='/package.json' )
fi
rsync -a \
  --exclude='.git' \
  --exclude='node_modules/' \
  --exclude='.orchestration/' \
  --exclude='.claude/worktrees/' \
  --exclude='.claude/settings.local.json' \
  --exclude='.astro/' \
  --exclude='public/vendor/' \
  --exclude='dashboard/*.html' \
  --exclude='dashboard/_astro/' \
  --exclude='dashboard/reports/' \
  --exclude='dashboard/steering/' \
  "${pkg_excludes[@]}" \
  "$ROOT"/ "$TARGET"/

# テンプレ本体の場合のみ、ダッシュボード用マニフェストの正本 package.scaffold.json を
# 複製先の package.json として配置する。プレースホルダ置換の前に置くことで、万一 name 等に
# （プロジェクト名）が含まれても後続の置換対象に入る。
if [ -f "$ROOT/package.scaffold.json" ]; then
  cp "$ROOT/package.scaffold.json" "$TARGET/package.json"
fi

# 派生元バージョンを記録（① テンプレへのフィードバック機構との連携）。
# 複製元に TEMPLATE_VERSION（複製元自身が派生プロジェクトであり祖先テンプレ由来の
# 値を保持している場合）があればそれを優先して継承する。複製元の VERSION を無条件に
# コピーすると、孫派生（親→子→孫）で子の VERSION が祖先テンプレ由来の値を上書きし、
# 追跡が断絶するため。
if [ -f "$ROOT/TEMPLATE_VERSION" ]; then
  cp "$ROOT/TEMPLATE_VERSION" "$TARGET/TEMPLATE_VERSION"
elif [ -f "$ROOT/VERSION" ]; then
  cp "$ROOT/VERSION" "$TARGET/TEMPLATE_VERSION"
else
  echo "warn: $ROOT/VERSION が見つかりません。TEMPLATE_VERSION は作成しません" >&2
fi

# プレースホルダ置換（対象ファイルを決め打ちしない: ページ数はテンプレの発展で増減するため、
# 複製済みの $TARGET を対象に grep でプレースホルダを含むテキストファイルを都度検出する。
# dashboard/*.html・_astro/・reports/・steering/ はビルド生成物であり複製自体をrsyncの
# 除外対象にしたため、ここでの置換対象にも自然と現れない。scripts/init-project.sh 自身は
# この置換パターンをコードとして保持する必要があるため、検出対象から明示的に除外する）
if [ -n "$PROJECT_NAME" ]; then
  echo "プレースホルダ（プロジェクト名）を置換中: $PROJECT_NAME"
  # sed の置換文字列として安全になるよう / と & をエスケープする
  esc_name="$(printf '%s' "$PROJECT_NAME" | sed -e 's/[\/&]/\\&/g')"
  self_script="$TARGET/scripts/init-project.sh"
  # -l: 該当ファイル名のみ出力 / -I: バイナリファイルは対象外 / -Z: NUL区切りで安全にループ
  while IFS= read -r -d '' f; do
    [ "$f" = "$self_script" ] && continue
    sed -i "s/（プロジェクト名）/${esc_name}/g" "$f"
  done < <(grep -rlZI "（プロジェクト名）" "$TARGET" --exclude-dir=.git)
fi

# 初期状態の status.json へ入れ替える（PO指示: 派生プロジェクトはテンプレの例データ入り
# status.json をそのまま受け取らず、初期状態から始める）。テンプレ本体の dashboard/status.json
# はテンプレの見本用サンプルデータのまま残し、複製先には dashboard/status.init.json（節目
# M0のみ・specs空の汎用初期状態）を status.json として配置する。mv で置換するため .init は
# 複製先に残らない。status.init.json 内の「（プロジェクト名）」も置換対象になるよう、
# プレースホルダ置換の後・git初期化の前でこの入れ替えを行う。
if [ -f "$TARGET/dashboard/status.init.json" ]; then
  mv -f "$TARGET/dashboard/status.init.json" "$TARGET/dashboard/status.json"
else
  echo "warn: $TARGET/dashboard/status.init.json が見つかりません。status.json は複製元のサンプルのまま残ります" >&2
fi

# git 初期化 + 初回コミット（user.name/email 未設定の環境でも失敗しないようフォールバックを渡す）
(
  cd "$TARGET"
  git init -q -b main
  # dashboard/ の生成物とビルド入力の整合を機械化するpre-commitフックを有効化する
  # （.githooks/pre-commit 本体はテンプレに同梱。詳細は同ファイルのコメント参照）。
  git config core.hooksPath .githooks
  git add -A
  base_version="$(cat "$TARGET/TEMPLATE_VERSION" 2>/dev/null || echo unknown)"
  # 初回コミットは --no-verify で行う: v0.4.0 の pre-commit フックは node_modules が
  # 無ければ検証をスキップして警告するだけでブロックはしないが、npm install 前の
  # この時点では status.json のスキーマ検証自体が意味を持たない（検証ロジックが
  # node_modules 配下の zod に依存する）ため、確実に速く完了させる目的で明示的に迂回する。
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
echo "     npm run build   # dashboard/status.json（初期状態）から初期状態のダッシュボードを生成（v0.4.0以降、生成物は複製されないため必須）"
echo "  3. README.md の「始め方」起動チェックリストに従い、product.md / tech.md / structure.md を記入"
echo "  4. .kiro/steering/role-catalog.md の「規模別プリセット（S/M/L）」から今回の規模を選び、配役を確定"
