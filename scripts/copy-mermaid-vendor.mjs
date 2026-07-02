#!/usr/bin/env node
// mermaid の UMD/グローバルビルド（mermaid.min.js）を node_modules から public/vendor/ へ
// コピーする（astro build 直前に実行）。
//
// なぜ必要か: mermaid を通常の ESM `import` で使うと、Astro はそのスクリプトを
// `type="module"` として出力する。type="module" のスクリプトは file:// オリジンからの
// ロードがブラウザのCORS制約でブロックされる（Chromium/主要ブラウザ共通の仕様）ため、
// ダッシュボードHTMLをダブルクリックで直接開いた場合に Mermaid 図が一切描画されない
// 回帰が発生した（独立レビューで発見）。
//
// 対処: mermaid の UMD ビルド（`window.mermaid` を定義する非モジュール版）を
// public/vendor/ 経由でビルド出力へそのままコピーする（Vite のモジュール処理を
// 通さない）。classic script（type="module" を付けない <script src="...">）は
// file:// でも問題なくロードできるため、これで file:// 直接オープンでも描画される。
//
// public/vendor/ は node_modules から機械的にコピーされる生成物のため git 管理対象外
// （.gitignore）。最終的な出力（dashboard/vendor/mermaid.min.js）は他の astro build
// 生成物と同様にコミットする。

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "node_modules", "mermaid", "dist", "mermaid.min.js");
const DEST_DIR = join(ROOT, "public", "vendor");
const DEST = join(DEST_DIR, "mermaid.min.js");

if (!existsSync(SRC)) {
  console.error(
    `mermaid の UMD ビルドが見つかりません: ${SRC}\nnpm install を実行してください。`,
  );
  process.exit(1);
}

mkdirSync(DEST_DIR, { recursive: true });
copyFileSync(SRC, DEST);
console.log(`copied: ${SRC} -> ${DEST}`);
