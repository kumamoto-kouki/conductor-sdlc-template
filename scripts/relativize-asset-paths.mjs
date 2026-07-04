#!/usr/bin/env node
// dashboard/ 配下の生成 HTML すべてに含まれるルート絶対パス（例:
// href="/_astro/xxx.css"）を、そのファイルの深さに応じた相対パス
// （直下なら "_astro/xxx.css"、1階層ネストなら "../_astro/xxx.css"）に書き換える。
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
// ポータル化（Wave3 #3）で dashboard/reports/<slug>.html・
// dashboard/steering/<slug>.html という1階層ネストしたページが増えたため、
// status-dashboard.html 決め打ちの単一ファイル書き換えから、dashboard/ 配下の
// 全 *.html を再帰的に探索してファイルごとの深さで相対パスを組み立てる方式に
// 一般化した。深さは "dashboard/" からの相対パスのディレクトリ階層数で決まる
// （例: dashboard/status-dashboard.html は深さ0→"_astro/…"、
// dashboard/reports/foo.html は深さ1→"../_astro/…"）。

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = join(__dirname, "..", "dashboard");

function findHtmlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

let changedCount = 0;

for (const htmlPath of findHtmlFiles(DASHBOARD_DIR)) {
  const rel = relative(DASHBOARD_DIR, htmlPath);
  const depth = rel.split(sep).length - 1; // 0 = dashboard/ 直下
  const prefix = depth > 0 ? "../".repeat(depth) : "";

  let html = readFileSync(htmlPath, "utf8");
  const before = html;

  // href="/_astro/..." や src="/_astro/..." → 深さに応じた相対パス
  html = html.replace(/(href|src)="\/(_astro)\//g, `$1="${prefix}$2/`);

  if (html !== before) {
    writeFileSync(htmlPath, html);
    changedCount++;
    console.log(
      `relativized: dashboard/${rel} の /_astro 参照 (depth=${depth})`,
    );
  }
}

if (changedCount === 0) {
  console.log("relativize-asset-paths: 書き換え対象なし");
}
