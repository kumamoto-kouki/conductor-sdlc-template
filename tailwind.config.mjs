/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#faf8f4",
        card: "#ffffff",
        fg: "#2b2622",
        muted: "#8a817a",
        line: "#e6e0d8",
        accent: "#b08968",
        ok: "#2e7d52",
        warn: "#d9a441",
        bad: "#b00020",
        info: "#3a6ea5",
        upd: "#2f6f9f",
        updbg: "#eaf3fa",
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
