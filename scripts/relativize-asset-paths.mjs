#!/usr/bin/env node
// dashboard/status-dashboard.html 内のルート絶対パス（例: href="/_astro/xxx.css"）を
// 相対パス（href="_astro/xxx.css"）に書き換える。
//
// なぜ必要か: Astro は _astro/ 配下の生成アセット（CSS・ESM チャンク含む）への参照を
// 既定でルート絶対パス（先頭 "/"）として出力する。正式閲覧は npm run preview
// （http配信）だが、file:// はコア表示のフォールバックとして残しており（PO決定・
// 2026-07-04・.claude/rules/dashboard-verification.md 参照）、file:// 上でルート
// 絶対パスはファイルシステムのルート（例: file:///_astro/xxx.css）に解決されて
// しまい実在しないため読み込みに失敗する（独立レビューで Mermaid の file:// 未対応と
// 同時に発覚。CSS が一切当たらず無装飾のページになる）。ESM 化後もこのCSS・JS
// チャンク参照の相対化は変わらず必要。
//
// dashboard/status-dashboard.html は常に dashboard/ 直下（_astro/ と同じ階層）に
// 生成されるフラットな構成のため、単純な相対パスへの書き換えで file:// / http://
// のどちらでも正しく解決できる。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, "..", "dashboard", "status-dashboard.html");

let html = readFileSync(HTML_PATH, "utf8");
const before = html;

// href="/_astro/..." や src="/_astro/..." → href="_astro/..."
html = html.replace(/(href|src)="\/(_astro)\//g, '$1="$2/');

if (html !== before) {
  writeFileSync(HTML_PATH, html);
  console.log("relativized: dashboard/status-dashboard.html の /_astro 参照");
} else {
  console.log("relativize-asset-paths: 書き換え対象なし");
}
