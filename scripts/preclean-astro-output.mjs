#!/usr/bin/env node
// astro build 前に dashboard/_astro/（ハッシュ付きファイル名の生成物ディレクトリ）と
// dashboard/reports/・dashboard/steering/（content collections 由来のポータルページ）を
// 削除する。
//
// なぜ必要か（dashboard/_astro/）: dashboard/ には status.json（唯一の真実・手編集される）
// が同居するため、Vite 既定の emptyOutDir を無効化している（astro.config.mjs 参照）。
// しかし emptyOutDir を無効化すると、コンテンツが変わって出力ファイル名のハッシュが
// 変わった際に「もう参照されない古いハッシュ付きファイル」が dashboard/_astro/ に
// 残り続け、ビルドのたびに増え続ける（例: Mermaid を ESM import から classic script
// 読み込みに変更した際、古い MermaidDiagram.astro_astro_type_script_*.js が孤児化した）。
//
// なぜ必要か（dashboard/reports/・dashboard/steering/）: ポータル化（Wave3 #3）で
// .claude/reports/*.md・.kiro/steering/*.md が content collections 経由のビルド入力に
// なった。emptyOutDir:false のため、ソース側の .md を削除しても対応する生成済み
// dashboard/reports/<slug>.html・dashboard/steering/<slug>.html は消えずに残り続け、
// 孤児ページとして公開され続ける（独立レビューの故障注入で発見）。検知ではなく原因
// 除去で塞ぐ: 毎ビルド前にこの2サブディレクトリを丸ごと削除し、astro build に現存する
// ソースから作り直させる。
//
// dashboard/_astro/・dashboard/reports/・dashboard/steering/ はいずれも100%生成物
// （手で書いたファイルは置かない規約）なので、ビルド直前に丸ごと消して astro build に
// 作り直させれば安全。status.json・status-dashboard.html・vendor/ はこれらの
// ディレクトリの外にあるため影響を受けない（dashboard/ 全体を空にするのは status.json
// 同居のため引き続き不可）。

import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = join(__dirname, "..", "dashboard");
const PRECLEAN_TARGETS = ["_astro", "reports", "steering"];

for (const name of PRECLEAN_TARGETS) {
  const target = join(DASHBOARD_DIR, name);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`precleaned: dashboard/${name}/`);
  } else {
    console.log(`preclean-astro-output: dashboard/${name}/ は削除対象なし`);
  }
}
