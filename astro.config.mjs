import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  // 現状は完全静的出力（ゼロ依存のビルド時HTML生成を Astro に置き換えたもの）。
  // 将来、動的レンダリング（例: 生成物をサーバーから配信し status.json の更新を
  // 都度反映する等）が必要になった場合は 'server' に切り替える余地を残す
  // （その場合はアダプタ追加が必要。今回は導入しない＝PO判断）。
  output: "static",
  // Astro 7 の compressHTML はインライン要素間の意味のある空白まで削るように
  // なり（例: 「スナップショット: <b>日付</b>」の空白が消えて文字が詰まる）、
  // Astro 5 で受理済みの見た目から実際に変わることをピクセル比較で確認した。
  // file:// 配布の単一HTMLでサイズ差も軽微なため、無効化して見た目を維持する。
  compressHTML: false,
  outDir: "./dashboard",
  // status-dashboard.html を直接出力（status-dashboard/index.html というディレクトリ形式にしない）。
  build: {
    format: "file",
  },
  integrations: [mdx()],
  // Astro 7 では @astrojs/tailwind（peer: astro ^3〜^5）が非対応になったため、
  // Tailwind v4 公式の Vite プラグイン方式へ移行（tailwind.config.mjs は
  // global.css の @config で読み込み、既存トークンをそのまま再利用する）。
  vite: {
    plugins: [tailwindcss()],
    build: {
      // dashboard/ には status.json（唯一の真実・手編集される）が同居するため、
      // ビルドのたびに outDir 全体を空にする既定の Vite 挙動を止める
      // （空にすると status.json ごと消えてしまい、次回ビルドが読み込めなくなる）。
      emptyOutDir: false,
    },
  },
});
