import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// ポータル化（Wave3 #3）: .kiro/steering/*.md の ```mermaid コードフェンスを、
// 本体ページ（status-dashboard.astro）と同じ `<pre class="mermaid">生コード</pre>`
// 構造へ変換する、依存ゼロの小さな rehype プラグイン。
//
// なぜ自前実装か: unist-util-visit 等は Astro の内部依存として node_modules に
// 存在するが package.json に明示依存していないため import すると壊れやすい
// （新規npm依存の追加は禁止＝PO決定）。hast ツリーは単純な type/tagName/children
// を持つプレーンオブジェクトなので、再帰的な手書き走査で十分に書ける。
//
// 変換対象: remark-rehype がコードフェンスから生成する
// `<pre><code class="language-mermaid">生コード</code></pre>` という定型構造
// （shiki のシンタックスハイライトは markdown.syntaxHighlight.excludeLangs で
// "mermaid" を除外し、この定型構造を壊させない。下記 markdown 設定参照）。
function rehypeMermaidFence() {
  function transformChildren(node) {
    if (!node || !Array.isArray(node.children)) return;
    node.children = node.children.map((child) => {
      const codeChild = child?.children?.[0];
      const isMermaidPre =
        child?.type === "element" &&
        child.tagName === "pre" &&
        Array.isArray(child.children) &&
        child.children.length === 1 &&
        codeChild?.type === "element" &&
        codeChild.tagName === "code" &&
        Array.isArray(codeChild.properties?.className) &&
        codeChild.properties.className.includes("language-mermaid");
      if (isMermaidPre) {
        const text = codeChild.children
          .filter((c) => c.type === "text")
          .map((c) => c.value)
          .join("");
        return {
          type: "element",
          tagName: "pre",
          properties: { className: ["mermaid"] },
          children: [{ type: "text", value: text }],
        };
      }
      transformChildren(child);
      return child;
    });
  }
  return (tree) => {
    transformChildren(tree);
  };
}

// 全幅化＋レスポンシブ対応（PO決定・2026-07-05）: Markdown（.claude/reports/*.md・
// .kiro/steering/*.md）が生成する素の <table> は、Astroコンポーネント側の表
// （SpecsTable・OperationsPanel等）と違い .table-scroll でラップされておらず、
// 390px幅では列数によってページ全体の横スクロールを引き起こす実測不具合が
// あった（例: steering/orchestration.md の3列表・レーン表）。rehypeMermaidFence
// と同じ依存ゼロの再帰走査で <table> を <div class="table-scroll"><table>...
// という構造へ包み、テーブル自身のコンテナ内だけで横スクロールさせる
// （.claude/rules/dashboard-verification.md の390px不変条件）。
function rehypeWrapTables() {
  function transformChildren(node) {
    if (!node || !Array.isArray(node.children)) return;
    node.children = node.children.map((child) => {
      if (child?.type === "element" && child.tagName === "table") {
        transformChildren(child);
        return {
          type: "element",
          tagName: "div",
          properties: { className: ["table-scroll"] },
          children: [child],
        };
      }
      transformChildren(child);
      return child;
    });
  }
  return (tree) => {
    transformChildren(tree);
  };
}

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
  // ポータル化（Wave3 #3）で content collections 経由の Markdown
  // （.claude/reports/*.md・.kiro/steering/*.md）に Mermaid コードフェンスの
  // 変換を効かせる。excludeLangs で "mermaid" を shiki のハイライト対象から外し
  // （外さないと shiki が pre>code.language-mermaid をハイライト用の複雑な構造へ
  // 作り替えてしまい、rehypeMermaidFence が期待する定型構造に一致しなくなる）、
  // rehypePlugins は shiki の後段で実行される（@astrojs/markdown-remark の
  // パイプライン順序）ため、shiki が手を付けなかった mermaid ブロックだけを
  // このプラグインが変換する。
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["math", "mermaid"],
    },
    rehypePlugins: [rehypeMermaidFence, rehypeWrapTables],
  },
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
