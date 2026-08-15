# tech-selection.md — 技術選定の判断基準

機能単位の設計（`design.md` の「技術選定」記入時）と、プロジェクト初期のスタック選定（`tech.md` 記入時）の両方に適用する。

## 1. 最新版でなく最新の安定版を選ぶ

**判断基準**：そのバージョンを前提にする周辺依存が既に追随しているかを確認してから採用する。`dev`／`rc`／`preview` タグは採用しない。

実例（2026-07-09、TypeScript 7 への移行検討）：TS7 は前日に GA したばかりで、Astro の型チェックを担う `@astrojs/check@0.9.9` の `peerDependencies.typescript` は `^5.0.0 || ^6.0.0` までしかカバーしていなかった（npm registry で実測確認）。最新版を採ると本体は動いても周辺エコシステムが追随しておらず統合できない。

確認方法の例：採用候補は `npm view <pkg> dist-tags` で `latest` を確認する。周辺依存は `npm view <dep> peerDependencies` でその依存が対応するバージョン範囲を確認する。

## 2. PO から採用技術の提案があっても、そのまま採用しない

**判断基準**：統括は自分の推奨案を1つ提示し、PO の提案技術と推奨案のメリット・デメリットを並べて PO に判断を仰ぐ。

理由：技術選定は PO の意思決定領域（`.kiro/steering/orchestration.md` の権限境界）であり、かつ現場からの提案は優先度の高い入力であって無条件の正解ではない。`.kiro/steering/role-catalog.md`／`.claude/playbooks/discovery-personas.md` が定める 🧑‍🚀 FDE charter の「現場情報は優先度の高い根拠であって無条件の正解ではない」という認識論と同じ位置づけになる。

PO が比較を踏まえて再度同じ技術を指示したら、それが決定である。以後同じ論点を蒸し返さない。

## 3. Build vs. Adopt との関係

`.claude/skills/kiro-spec-design/rules/design-synthesis.md` §2 Build vs. Adopt は「自作するか既存を採るか」を扱う。本ファイルは、Adopt と決めた後の「どの既存を・どのバージョンで」採るかを扱う。両者は別の問いであり、内容を重複させない。
