#!/usr/bin/env node
// astro build 前に dashboard/_astro/（ハッシュ付きファイル名の生成物ディレクトリ）を
// 削除する。
//
// なぜ必要か: dashboard/ には status.json（唯一の真実・手編集される）が同居するため、
// Vite 既定の emptyOutDir を無効化している（astro.config.mjs 参照）。しかし
// emptyOutDir を無効化すると、コンテンツが変わって出力ファイル名のハッシュが変わった
// 際に「もう参照されない古いハッシュ付きファイル」が dashboard/_astro/ に残り続け、
// ビルドのたびに増え続ける（例: Mermaid を ESM import から classic script 読み込みに
// 変更した際、古い MermaidDiagram.astro_astro_type_script_*.js が孤児化した）。
//
// dashboard/_astro/ は100%生成物（手で書いたファイルは置かない規約）なので、
// ビルド直前に丸ごと消して astro build に作り直させれば安全。status.json・
// status-dashboard.html・vendor/ はこのディレクトリの外にあるため影響を受けない。

import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASTRO_OUT_DIR = join(__dirname, "..", "dashboard", "_astro");

if (existsSync(ASTRO_OUT_DIR)) {
  rmSync(ASTRO_OUT_DIR, { recursive: true, force: true });
  console.log(`precleaned: dashboard/_astro/`);
} else {
  console.log("preclean-astro-output: 削除対象なし");
}
