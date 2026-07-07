---
paths:
  - .kiro/steering/**
  - .claude/playbooks/**
  - .claude/skills/**
---

## steering／playbook／skill 間の整合性

- 同じ事実を2箇所以上の prose／表で独立に書かない。正本を1つ決め、他方は参照（リンク）にする。プロダクトルールと同じ Single Source of Truth 違反が、判断基準やフェーズ表のような運用ドキュメントでも起きる（実例：2026-07-08 の監査で、`delegation.md`⇄`orchestration.md` の判断基準の乖離・`full-sdlc.md`⇄`role-catalog.md` のフェーズ表重複など、独立した文章コピーに起因する不整合を7件発見した）。
- フォーマットが本質的に異なる双子（JSON/Mermaid vs prose 表）は参照だけでは済ませられない。文章として書き写す先を持てないため、機械的な drift チェックを設ける（実例：`role-catalog.md`⇄`src/data/personas.json` の役割名整合チェック＝`scripts/verify-dashboard.mjs`）。
- 新しい役割・フェーズ・判断基準を `role-catalog.md` や `orchestration.md` に追加したら、参照している他文書（`full-sdlc.md`・`kiro-discovery` 等のスキル・`personas.json`・`team-structure.mdx`）に波及が要るかを都度確認する。正本を更新した直後に反映漏れが起きやすいため、正本の変更コミットと同じタイミングで確認する。
