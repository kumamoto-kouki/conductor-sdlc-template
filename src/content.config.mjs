// ポータル化（Wave3 #3）: `.claude/reports/*.md` と `.kiro/steering/*.md` を
// content collections（glob loader）で取り込み、一覧・詳細ページを生成する。
//
// なぜ生の fs 読み込みでなく content collections か: Astro の Markdown パイプライン
// （remarkPlugins/rehypePlugins・shiki）をそのまま通せば、本体ページと同じ
// Mermaid コードフェンス変換（astro.config.mjs の rehypeMermaidFence 参照）が
// 自動で効く。生の fs.readFileSync + 独自パーサーだとこの変換を二重実装することになる。
//
// frontmatter は無い運用（既存の .md はどれも frontmatter を持たない）ため、
// schema は指定しない（空オブジェクトスキーマとして扱われ、フィールド必須化は
// 何も強制しない）。タイトルは各ページ側で本文先頭の `# 見出し` から抽出する
// （抽出できない場合はファイル名にフォールバック）。
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const reports = defineCollection({
  loader: glob({ pattern: "*.md", base: ".claude/reports" }),
});

const steering = defineCollection({
  loader: glob({ pattern: "*.md", base: ".kiro/steering" }),
});

export const collections = { reports, steering };
