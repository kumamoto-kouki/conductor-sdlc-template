# Agentic SDLC と仕様駆動開発

エージェンティック SDLC 上で実践する Kiro スタイルの仕様駆動開発

## プロジェクトコンテキスト

### パス

- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

### Steering と Specification の違い

**Steering**（`.kiro/steering/`）- プロジェクト全体のルールとコンテキストで AI を導く
**Specs**（`.kiro/specs/`）- 個別機能の開発プロセスを形式化する

### 有効な仕様（Active Specifications）

- 有効な仕様は `.kiro/specs/` を確認する
- 進捗確認には `/kiro-spec-status [feature-name]` を使う

## 開発ガイドライン

- 思考は英語で行ってよいが、**PO への応答は PO の言語で行う**（このテンプレートの既定は日本語。steering・playbooks・skills・docs もすべて日本語で書かれている）。プロジェクトファイルとして書き出すすべての Markdown コンテンツ（requirements.md、design.md、tasks.md、research.md、検証レポートなど）は、その仕様に設定された対象言語（`spec.json` の language を参照）で記述しなければならない。

## 最小ワークフロー

- 初回導入: `/kiro-onboard`（AI が対話で誘導。詳細は `.claude/skills/kiro-onboard/SKILL.md`）
- フェーズ 0（任意）: `/kiro-steering`、`/kiro-steering-custom`
- Discovery: `/kiro-discovery "idea"` — 進め方を判定し、複数スペックのプロジェクトでは brief.md と roadmap.md を作成する
- フェーズ 1（仕様策定）:
  - 単一スペック: `/kiro-spec-quick {feature} [--auto]`、またはステップごとに実行:
    - `/kiro-spec-init "description"`
    - `/kiro-spec-requirements {feature}`
    - `/kiro-validate-gap {feature}`（任意: 既存コードベースがある場合）
    - `/kiro-spec-design {feature} [-y]`
    - `/kiro-validate-design {feature}`（任意: 設計レビュー）
    - `/kiro-spec-tasks {feature} [-y]`
  - 複数スペック: `/kiro-spec-batch` — roadmap.md をもとに、依存関係の波（wave）ごとに全スペックを並列作成する（既定では承認しない。`--auto-approve` 指定時のみ全承認）
- 承認: `/kiro-approve {feature} [phase]` — PO が成果物を読んで承認を記録する。1回につき1段のみ。`-y` は読まずに飛ばすファストトラックであり、承認の既定手段ではない
- フェーズ 2（実装）: `/kiro-impl {feature} [tasks]`
  - タスク番号なし: 自律モード（タスクごとのサブエージェント + 独立レビュー + 最終検証）
  - タスク番号あり: 手動モード（選択したタスクをメインコンテキストで実行。完了前のレビュアーゲートは同様に適用）
  - `/kiro-validate-impl {feature}`（単独での再検証）
- 進捗確認: `/kiro-spec-status {feature}`（いつでも使用可）
- プロジェクト終了: `/kiro-offboard`（AI が対話で誘導）

## Skills の構成

Skills は `.claude/skills/kiro-*/SKILL.md` に配置されている

- 各 Skill は `SKILL.md` を持つディレクトリである
- Skills は会話コンテキストにアクセスしたままインラインで実行される
- Skills は効率化のために並列リサーチをサブエージェントへ委譲することがある
- Skill ディレクトリには追加ファイル（テンプレート、サンプル）を置いてよい
- `kiro-review` — レビュアーサブエージェントが用いる、タスク単位の敵対的レビュープロトコル
- `kiro-debug` — デバッガーサブエージェントが用いる、根本原因優先のデバッグプロトコル
- `kiro-verify-completion` — 成功・完了を主張する前に通す、新規エビデンスによるゲート
- **完了主張・レビュー・承認・デバッグの各ゲートに該当する作業では、対応する Skill（`kiro-verify-completion`・`kiro-review`・`kiro-approve`・`kiro-debug`）を必ず通すこと**。ゲートは「単純に見えるから」で飛ばしてはならない。それ以外の場面でどの Skill を引くかは、タスクとの関連性を自分で見積もって判断してよい——スキル1本の読み込みは数万字のコンテキストを消費するため、薄い関連で引くこと自体がコストである。

## 開発ルール

- 3 フェーズ承認ワークフロー: Requirements → Design → Tasks → Implementation
- 各フェーズで人間のレビューが必須。`-y` は意図的なファストトラック時のみ使う
- Steering を最新に保ち、`/kiro-spec-status` で整合性を検証する
- ユーザーの指示に正確に従い、その範囲内では自律的に動くこと。必要なコンテキストは自分で集め、要求された作業をこの実行内で最後までやり切る。質問するのは、必須情報が欠けている場合か、指示が致命的に曖昧な場合に限る。

## Steering の設定

- `.kiro/steering/` 全体をプロジェクトメモリとして読み込む
- 既定ファイル: `product.md`、`tech.md`、`structure.md`
- カスタムファイルもサポートする（`/kiro-steering-custom` で管理）

## ハーネス規約（rules / reports）

- `.claude/rules/` — パスの glob にマッチしたときに読み込まれる規約ファイル。追加の要否と方法は `.claude/rules/README.md` を参照。まだ存在しないパターンに対して先回りしてルールを書かないこと。
- `.claude/reports/` — 軽量なセッションレポート / 作業メモ（`YYYY-MM-DD-<topic>.md`）。`.claude/reports/README.md` を参照。恒久的な記録場所ではない: 恒久的な内容は判明した時点で本来の置き場所へ直接書くこと — バージョン履歴は `CHANGELOG.md`、横断的な学びは `.kiro/steering/`、パス限定の学びは `.claude/rules/`、委譲・プレイブックの改善は `.claude/playbooks/`。レポートは、恒久的な内容を他所へ書き出した後であればいつ削除してもよい。

## トークン / コスト効率

- モデル: 実装タスクは既定で Sonnet を使う。Opus は設計フェーズのレビュー（`kiro-spec-design` / `kiro-validate-design`）と複雑なアーキテクチャ判断に温存する
- 委譲の階層: サブエージェントの作業は役割ではなくタスクの性質で切り分ける（根拠: [coordinator/worker パターン](https://github.com/anthropics/claude-cookbooks/blob/main/managed_agents/CMA_plan_big_execute_small.ipynb)）。価格表・`effort` 適合の詳細は `.claude/playbooks/model-assignment.md` を参照。
- 微妙な判断を含む対象のレビューをコスト削減のために格下げしないこと。また自分で答えられることを委譲しないこと — サブエージェント呼び出しには固定の下限コストがあるため、過度に細分化せず、まとまりのある作業をバッチ化する
- コンテキスト: 大きなファイルでは全文読み込みではなく、範囲を絞った `Read`（`offset` / `limit` 付き）や `Grep` を優先する。広範囲・不確実な探索は Explore サブエージェントに任せ、メインコンテキストを軽く保つ
- 出力: 応答は簡潔に保つ。会話中に既出のファイル内容を再掲しない
- セッション衛生: 無関係な spec へ切り替えるときは `/clear`、マイルストーンの区切りでは `/compact` を使う
- `PostToolUse` フック（`.claude/hooks/format-on-edit.mjs`）が Edit/Write の後に rustfmt（`.rs`）と prettier（`.js`/`.css`/`.html`/`.json`/`.md`）を自動実行するため、フックが処理するフォーマットの問題を手動で直し直さないこと
