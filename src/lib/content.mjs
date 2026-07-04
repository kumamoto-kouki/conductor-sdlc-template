// ポータル化（Wave3 #3）: .claude/reports/*.md・.kiro/steering/*.md
// （content collections）の共通ユーティリティ。
// frontmatter が無い運用のため、タイトルは本文先頭の `# 見出し` から抽出する
// （無ければファイル名をタイトル代わりに使う）。

/**
 * Markdown 本文の先頭にある `# 見出し` を抽出する。
 * 見つからない場合は id（ファイル名の拡張子抜き）を人が読める形に整えて返す。
 */
export function titleFromEntry(entry) {
  const body = entry.body || "";
  const match = body.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return entry.id.replace(/\.md$/, "");
}

/**
 * 一覧表示用に、ファイル名（id）降順でソートする。
 * 大半のファイルは `YYYY-MM-DD-topic.md` の日付プレフィックスを持つため、
 * 文字列としての降順ソートがそのまま新しい順になる。日付を持たないファイル
 * （README.md・_example-*.md 等）も除外せず同じ一覧に含める
 * （「情報を選別して落とさない」という要件のため）。
 */
export function sortEntriesDesc(entries) {
  return [...entries].sort((a, b) => b.id.localeCompare(a.id));
}
