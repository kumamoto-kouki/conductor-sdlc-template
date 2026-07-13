#!/usr/bin/env node
// conductor-sdlc-template のスキャフォルダ CLI 入口。
//
//   npx github:kumamoto-kouki/conductor-sdlc-template <target-dir> [project-name]
//
// 本体ロジック（複製・プレースホルダ置換・status.json 入替・git 初期化）の正本は
// bash の scripts/init-project.sh に置く。この Node ラッパーは「パッケージマネージャー
// (npx) から起動できる薄い入口」を提供するだけで、ロジックは持たない（2言語での二重管理を避ける）。
// npx github: 経由では npm がリポジトリを一時領域へ clone し、その clone がここでの
// PKG_ROOT になる。init-project.sh は PKG_ROOT を複製元 (ROOT) として解決し、そのまま機能する。
//
// 対象は Unix 系（bash 前提）。Windows ネイティブは非対応（WSL を使う）。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(PKG_ROOT, "scripts", "init-project.sh");

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
  console.log(
    [
      "usage: npx github:kumamoto-kouki/conductor-sdlc-template <target-dir> [project-name]",
      "",
      "  <target-dir>    複製先の新規ディレクトリ（既存だと中止）",
      "  [project-name]  （プロジェクト名）プレースホルダの置換値（任意）",
    ].join("\n"),
  );
  process.exit(args.length === 0 ? 1 : 0);
}

// Windows ネイティブは bash 前提のため非対応（WSL を案内する）。
if (process.platform === "win32") {
  fail(
    "Windows ネイティブは未対応です。WSL（Ubuntu 等）内で bash を使って実行してください。",
  );
}

if (!existsSync(SCRIPT)) {
  fail(
    `${SCRIPT} が見つかりません。パッケージの取得が壊れている可能性があります。`,
  );
}

// init-project.sh を stdio 継承で起動し、その終了コードを透過する。
// cwd はユーザーの呼び出し位置のまま渡す（相対 target-dir がユーザーの意図どおり解決されるように）。
const res = spawnSync("bash", [SCRIPT, ...args], {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (res.error) {
  if (res.error.code === "ENOENT") {
    fail(
      "bash が見つかりません。Unix 系シェル（または WSL）で実行してください。",
    );
  }
  fail(String(res.error.message || res.error));
}
process.exit(res.status ?? 1);
