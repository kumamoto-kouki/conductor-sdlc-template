#!/usr/bin/env node
// dashboard/status-dashboard.html 内のルート絶対パス（例: href="/_astro/xxx.css"）を
// 相対パス（href="_astro/xxx.css"）に書き換える。
//
// なぜ必要か: Astro は public/ や _astro/ 配下の生成アセットへの参照を既定で
// ルート絶対パス（先頭 "/"）として出力する。これは通常のHTTPサーバー配信では
// 問題ないが、本ダッシュボードは file:// で直接ダブルクリックして開く運用を
// 前提としており、file:// 上でルート絶対パスはファイルシステムのルート
// （例: file:///_astro/xxx.css）に解決されてしまい、実在しないため読み込みに
// 失敗する（独立レビューで Mermaid の file:// 未対応と同時に発覚。CSS が
// 一切当たらず無装飾のページになる）。
//
// dashboard/status-dashboard.html は常に dashboard/ 直下（_astro/・vendor/ と
// 同じ階層）に生成されるフラットな構成のため、単純な相対パスへの書き換えで
// file:// / http:// のどちらでも正しく解決できる。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, "..", "dashboard", "status-dashboard.html");

let html = readFileSync(HTML_PATH, "utf8");
const before = html;

// href="/_astro/..." や src="/_astro/..." → href="_astro/..." （vendor/ も同様）
html = html.replace(/(href|src)="\/(_astro|vendor)\//g, '$1="$2/');

if (html !== before) {
  writeFileSync(HTML_PATH, html);
  console.log(
    "relativized: dashboard/status-dashboard.html の /_astro, /vendor 参照",
  );
} else {
  console.log("relativize-asset-paths: 書き換え対象なし");
}
