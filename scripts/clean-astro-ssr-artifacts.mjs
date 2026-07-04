#!/usr/bin/env node
// astro build の内部SSR専用アーティファクト（dashboard/manifest_*.mjs・chunks/・pages/・
// _noop-middleware.mjs・noop-entrypoint.mjs・renderers.mjs・.prerender/）をビルド後に
// 削除する。
//
// なぜ必要か: dashboard/ には status.json（唯一の真実・手編集される）が同居するため、
// astro.config.mjs で Vite の emptyOutDir を無効化している（有効だと status.json ごと
// 消える）。しかし emptyOutDir を無効化すると、astro build が静的HTML生成のために
// 内部的にのみ使う SSR バンドル（manifest_*.mjs 等）が outDir 直下に残ってしまい、
// ビルドのたびに増え続ける（このファイル群は生成された status-dashboard.html や
// _astro/ 配下のブラウザ向けアセットからは一切参照されない＝安全に削除できる）。
//
// 独立レビューで、status.json のバリデーション失敗時（zodエラーでastro buildが
// 途中終了する場合）に manifest_*.mjs 等とは別名の内部ファイル
// （_noop-middleware.mjs・noop-entrypoint.mjs・renderers.mjs）も残留することが
// 判明したため、固定ファイル名としてリストに追加した（2026-07-02）。
//
// Astro 7 では SSR 内部バンドルの配置が outDir 直下ばら撒きから
// dashboard/.prerender/ ディレクトリ1つへの集約に変わった。成功ビルドでは Astro
// 自身が .prerender/ を消すが、ビルド途中で失敗（zod 検証エラー等）すると丸ごと
// 残留することを Astro 7.0.6 移行時の失敗ビルド検証で確認したため、削除対象に
// 追加した（2026-07-04）。旧レイアウトの項目も、過去ビルドの残骸を掃除できるよう
// リストに残している。
//
// 使い方: astro build の直後に実行する（package.json の "build" スクリプト参照）。

import { readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = join(__dirname, "..", "dashboard");

const FIXED_SSR_FILE_NAMES = new Set([
  "_noop-middleware.mjs",
  "noop-entrypoint.mjs",
  "renderers.mjs",
]);

let removed = 0;

for (const entry of readdirSync(DASHBOARD_DIR)) {
  const isSsrManifest = /^manifest_.*\.mjs$/.test(entry);
  const isSsrDir =
    entry === "chunks" || entry === "pages" || entry === ".prerender";
  const isFixedSsrFile = FIXED_SSR_FILE_NAMES.has(entry);
  if (!isSsrManifest && !isSsrDir && !isFixedSsrFile) continue;

  const fullPath = join(DASHBOARD_DIR, entry);
  const isDir = statSync(fullPath).isDirectory();
  rmSync(fullPath, { recursive: isDir, force: true });
  removed++;
  console.log(`cleaned: dashboard/${entry}`);
}

if (removed === 0) {
  console.log("clean-astro-ssr-artifacts: 削除対象なし");
}
