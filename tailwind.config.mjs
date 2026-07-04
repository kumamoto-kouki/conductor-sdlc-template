/** @type {import('tailwindcss').Config} */
// Tailwind v4 では本ファイルは src/styles/global.css の @config から互換レイヤーとして
// 読み込まれる（theme.extend のトークン定義の正本）。クラス走査の対象はこの content
// ではなく global.css の source(none) + @source "../" が決める点に注意（v4 は content
// を尊重せず自動検出で生成物の dashboard/*.html まで走査し、ビルドが非決定になる
// ことを実測したため明示制限している）。
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--c-bg)",
        card: "var(--c-card)",
        surface: "var(--c-surface)",
        fg: "var(--c-fg)",
        muted: "var(--c-muted)",
        line: "var(--c-line)",
        accent: {
          DEFAULT: "var(--c-accent)",
          hover: "var(--c-accent-hover)",
          fg: "var(--c-accent-fg)",
          soft: "var(--c-accent-soft)",
        },
        ok: { DEFAULT: "var(--c-ok)", soft: "var(--c-ok-soft)" },
        warn: { DEFAULT: "var(--c-warn)", soft: "var(--c-warn-soft)" },
        bad: { DEFAULT: "var(--c-bad)", soft: "var(--c-bad-soft)" },
        info: { DEFAULT: "var(--c-info)", soft: "var(--c-info-soft)" },
        lane: { design: "var(--c-lane-design)", eng: "var(--c-lane-eng)" },
        // 案Aのトークンセットに upd/updbg は無いため、既存コンポーネント
        // （badge-upd 等）が前提にする旧トークン名を後方互換で残す
        // （意味的に近い accent へエイリアス）。
        upd: "var(--c-accent)",
        updbg: "var(--c-accent-soft)",
      },
      boxShadow: {
        card: "var(--sh-card)",
        "card-hover": "var(--sh-card-hover)",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "Hiragino Kaku Gothic ProN",
          "Noto Sans JP",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
