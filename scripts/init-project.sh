#!/usr/bin/env bash
# テンプレート一式を新規プロジェクトディレクトリへ複製し、git初期化・プレースホルダ置換までを行う。
#   使い方: scripts/init-project.sh <target-dir> [project-name]
#
# 除外（ローカル専用・再生成される中間物のみコピーしない）:
#   .git / node_modules / .orchestration / .claude/worktrees / .claude/settings.local.json
# 加えて CLI 固有物も除外する: ルート /package.json（複製元のCLIマニフェスト）・/bin/（npx入口）・
#   /package-lock.json・/package.scaffold.json。複製先の package.json には package.scaffold.json
#   （生成プロジェクト用マニフェストの正本）を配置する（詳細は下記の複製処理のコメント参照）。
# 注意: v0.12.0 でダッシュボード（Astro）を撤去したため、複製時のビルド生成物の扱いは無くなった。
# テンプレート由来の依存パッケージはゼロで、複製直後に npm install は要らない（node があれば
# npm run status / npm run verify が動く）。複製先が自身のアプリ依存を追加した時点で、その
# プロジェクトが自分で npm install する。
#
# [project-name] を指定すると、複製先ツリー全体を対象に「（プロジェクト名）」プレースホルダを
# 置換する。対象ファイルは固定せず複製後に grep で検出するため、ページ追加に追随する。
# scripts/init-project.sh 自身はこのプレースホルダ表記をコードとして持つため置換対象から外す。
# 複製先には TEMPLATE_VERSION を記録する（派生元バージョンの追跡。詳細は
# .claude/playbooks/template-feedback.md を参照）。複製元に TEMPLATE_VERSION があれば
# それを継承し、無ければ VERSION の内容を使う（孫派生でのテンプレ由来バージョン断絶を防止）。
# 加えて .kiro/steering/role-catalog.md の「採用中プリセット」行を「未選択」へ戻す（テンプレ本体の
# 値を複製先が暗黙に引き継がないようにするため）。この置換は行頭の **採用中プリセット** という表記に
# 依存するので、role-catalog.md 側の文言を変えるときは下記 sed パターンも同時に直す。
# 複製先の STATUS.md は複製後に scripts/status-report.mjs で作り直す（複製元の STATUS.md は
# 複製元の spec と配役から導出された内容であり、複製先の実態ではないため）。
# 複製先の .gitignore は template.gitignore（テンプレ本体の .gitignore と同一内容の双子）を
# リネームして作る。npm はパッキング時に .gitignore を tarball から常時除外するため、npx 経由の
# 複製では素の .gitignore を直接運べない（当時は node_modules・.astro・dashboard/ 生成物が
# 複製先で未追跡ファイルとして現れる不具合の原因だった）。git 初期化より前に配置すること。
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
#   /package-lock.json … 複製元のロックファイル。テンプレート由来の依存はゼロなので運ぶ意味が無く、
#                         複製先が自身のアプリ依存を入れた時点で自分で作り直す。
#   /package.scaffold.json … 複製先 package.json の中身（テンプレ本体のみ保持）。cp で明示配置する。
# 先頭 '/' 付き exclude は転送ルート直下のみに効く（配下の同名は対象外）。
#
# package.json の扱いは複製元の種別で分岐する:
#   - テンプレ本体（$ROOT/package.scaffold.json あり）: 複製元 root の package.json は CLI マニフェスト
#     （bin 入り）で複製先に不適切なため除外し、代わりに package.scaffold.json を
#     複製先の package.json として配置する。
#   - 派生プロジェクト（package.scaffold.json 無し・孫派生時）: root の package.json は既に生成
#     プロジェクト用マニフェストなので、そのまま複製する（除外も cp もしない）。これにより孫派生でも成立する。
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
  "${pkg_excludes[@]}" \
  "$ROOT"/ "$TARGET"/

# テンプレ本体の場合のみ、生成プロジェクト用マニフェストの正本 package.scaffold.json を
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

# 複製先自身の VERSION は初期値へ戻す。rsync は複製元の VERSION をそのまま運ぶため、
# 何もしないと「新規プロジェクトなのに版がテンプレートの最新版になっている」状態に
# なる（派生元の追跡は上の TEMPLATE_VERSION が担うので、ここで引き継ぐ必要はない）。
# package.scaffold.json の version と揃える。
if [ -f "$TARGET/VERSION" ]; then
  echo "0.1.0" > "$TARGET/VERSION"
fi

# プレースホルダ置換（対象ファイルを決め打ちしない: ページ数はテンプレの発展で増減するため、
# 複製済みの $TARGET を対象に grep でプレースホルダを含むテキストファイルを都度検出する。
# scripts/init-project.sh 自身はこの置換パターンをコードとして保持する必要があるため、
# 検出対象から明示的に除外する）
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

# 採用中プリセット行を複製先だけ「未選択」へ戻す。テンプレ本体の値（M）はテンプレ自身の開発体制で
# あり、複製先がそれを暗黙に引き継ぐと「今回の規模を選ぶ」判断そのものが飛ばされるため。
role_catalog="$TARGET/.kiro/steering/role-catalog.md"
if [ -f "$role_catalog" ] && grep -q '^\*\*採用中プリセット\*\*' "$role_catalog"; then
  sed -i 's|^\*\*採用中プリセット\*\*.*|**採用中プリセット**：未選択（複製直後の初期値。最初の spec に着手する前に「規模別プリセット（S/M/L）」から選び、この行と下表の 状態 列を書き換える）|' "$role_catalog"
else
  echo "warn: $role_catalog に「採用中プリセット」行が見つかりません。手動で確認してください" >&2
fi

# STATUS.md を複製先の実態から作り直す（旧: 例データ入り status.json を status.init.json へ
# 入れ替えていた処理の後継）。STATUS.md は .kiro/specs/ と .kiro/steering/role-catalog.md からの
# 導出結果であり、複製してきたものは複製元の spec と採用プリセットを映しているため、そのまま
# 残すと複製先の実態と食い違う。プレースホルダ置換とプリセット「未選択」への差し戻しの後・
# git 初期化の前に実行すること（導出元が確定した状態で作る必要があるため）。
# 生成器は依存パッケージを持たないので npm install は不要。node が無い環境では警告のみ出して
# 続行する（複製自体は成立し、複製先で `npm run status` を一度実行すれば直る）。
if [ ! -f "$TARGET/scripts/status-report.mjs" ]; then
  echo "warn: $TARGET/scripts/status-report.mjs が見つかりません。STATUS.md は複製元の内容のまま残ります" >&2
elif ! command -v node >/dev/null 2>&1; then
  echo "warn: node が見つかりません。STATUS.md は複製元の内容のまま残ります（複製先で 'npm run status' を実行してください）" >&2
elif ! (cd "$TARGET" && node scripts/status-report.mjs >/dev/null); then
  echo "warn: STATUS.md の生成に失敗しました。複製先で 'npm run status' を実行してください" >&2
fi

# template.gitignore を .gitignore として配置する（npm パッキング対策）。npm は tarball 作成時に
# .gitignore を常時除外するため（.npmignore を足しても .gitignore 自体は除外されたまま解決しない）、
# リポジトリ直下に同一内容の双子 template.gitignore を置いて配り、複製先でこの名前へリネームする。
# git 初期化より前に置くこと: 後にすると初回コミットに node_modules 等が含まれてしまう。
if [ -f "$TARGET/template.gitignore" ]; then
  mv -f "$TARGET/template.gitignore" "$TARGET/.gitignore"
else
  echo "warn: $TARGET/template.gitignore が見つかりません。.gitignore は配置されません" >&2
fi

# git 初期化 + 初回コミット（user.name/email 未設定の環境でも失敗しないようフォールバックを渡す）
(
  cd "$TARGET"
  git init -q -b main
  # STATUS.md を導出元の変更に追随させる pre-commit フックを有効化する
  # （.githooks/pre-commit 本体はテンプレに同梱。詳細は同ファイルのコメント参照）。
  git config core.hooksPath .githooks
  git add -A
  base_version="$(cat "$TARGET/TEMPLATE_VERSION" 2>/dev/null || echo unknown)"
  # 初回コミットは --no-verify で行う: pre-commit フックの仕事（STATUS.md の再生成）は
  # 直前に明示的に済ませてあるため走らせる必要が無い。初期化を決定的かつ速く終わらせる
  # ため、ここだけ明示的に迂回する（フック自体は上の core.hooksPath 設定で有効なまま）。
  git -c user.name="$(git config user.name 2>/dev/null || echo project-init)" \
    -c user.email="$(git config user.email 2>/dev/null || echo project-init@local)" \
    commit -q --no-verify -m "chore: initialize project from conductor-sdlc-template (base VERSION ${base_version})"
)

echo ""
echo "完了: $TARGET"
echo ""
echo "次にやること:"
echo "  1. 新しいフォルダを Claude Code で開く"
echo "     VS Code の場合: 「ファイル > フォルダーを開く」で次を選ぶ: $TARGET"
echo "     ターミナルの場合: cd \"$TARGET\" のあと claude と入力する"
echo "  2. 開いたら /kiro-onboard と入力する。あとは AI が順に質問して進めます"
