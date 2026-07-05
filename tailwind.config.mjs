/** @type {import('tailwindcss').Config} */
// Tailwind v4 では本ファイルは src/styles/global.css の @config から互換レイヤーとして
// 読み込まれる（theme.extend のトークン定義の正本）。クラス走査の対象はこの content
// ではなく global.css の source(none) + @source "../" が決める点に注意（v4 は content
// を尊重せず自動検出で生成物の dashboard/*.html まで走査し、ビルドが非決定になる
// ことを実測したため明示制限している）。
// 最小フォント14px化（PO指示 v2 #4）: 既定スケール（xs=12px/sm=14px/base=16px/
// lg=18px/xl=20px/2xl=24px/3xl=30px）を丸ごと ×7/6（≈1.167）した値で上書きする。
// 旧xs(12px)がちょうど新しい最小値14pxに一致するよう倍率を選び、
// 「他のサイズも相対的に拡大（比率を保つ）」を単一の倍率で満たす。
// これに合わせ src/ 側の text-[Npx] アービトラリ値（10〜13.5px）は全廃し、
// このスケールの名前付きクラス（text-xs/sm/base/...）へ置換済み
// （置換の網羅性は `grep -rn 'text-\[1[0-3]' src` がゼロ件であることで確認する）。
const FONT_SIZE = {
  xs: ["0.875rem", { lineHeight: "1.4" }], // 14px（旧12px）
  sm: ["1rem", { lineHeight: "1.5" }], // 16px（旧14px）
  base: ["1.1875rem", { lineHeight: "1.65" }], // 19px（旧16px）
  lg: ["1.3125rem", { lineHeight: "1.5" }], // 21px（旧18px）
  xl: ["1.4375rem", { lineHeight: "1.4" }], // 23px（旧20px）
  "2xl": ["1.75rem", { lineHeight: "1.3" }], // 28px（旧24px）
  "3xl": ["2.1875rem", { lineHeight: "1.2" }], // 35px（旧30px）
};

export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    fontSize: FONT_SIZE,
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
