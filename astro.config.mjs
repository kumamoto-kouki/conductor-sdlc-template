import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  // 現状は完全静的出力（ゼロ依存のビルド時HTML生成を Astro に置き換えたもの）。
  // 将来、動的レンダリング（例: 生成物をサーバーから配信し status.json の更新を
  // 都度反映する等）が必要になった場合は 'server' に切り替える余地を残す
  // （その場合はアダプタ追加が必要。今回は導入しない＝PO判断）。
  output: "static",
  outDir: "./dashboard",
  // status-dashboard.html を直接出力（status-dashboard/index.html というディレクトリ形式にしない）。
  build: {
    format: "file",
  },
  integrations: [mdx(), tailwind({ applyBaseStyles: false })],
  // dashboard/ には status.json（唯一の真実・手編集される）が同居するため、
  // ビルドのたびに outDir 全体を空にする既定の Vite 挙動を止める
  // （空にすると status.json ごと消えてしまい、次回ビルドが読み込めなくなる）。
  vite: {
    build: {
      emptyOutDir: false,
    },
  },
});
