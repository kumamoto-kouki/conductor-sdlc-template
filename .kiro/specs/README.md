# specs/ — 機能ごとの仕様

各機能を `.kiro/specs/<feature>/` に **requirements → design → tasks** の3段で作る（`/kiro-spec-init` → `/kiro-spec-requirements` → `/kiro-spec-design` → `/kiro-spec-tasks`、または `/kiro-spec-quick`）。各フェーズは人間レビューで承認（CLAUDE.md「Development Rules」）。実装は `/kiro-impl`。

このディレクトリは初期は空。最初の機能を作ると `<feature>/` が生える。
