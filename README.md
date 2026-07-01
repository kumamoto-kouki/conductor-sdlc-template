# conductor-sdlc-template

**AI エージェント主体の開発を、コンダクター・オーケストレーション＋Kiro Spec-Driven Development＋可視化ダッシュボードで回す**ためのプロジェクト・テンプレート。実プロジェクト（（プロジェクト名））で確立した手法・体制・ノウハウ・ダッシュボードの骨格を、次のプロジェクトの起点として切り出したもの。

## 何が入っているか

| 要素                   | 場所                                                   | 内容                                                                                                                                  |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| SDLC エンジン          | `.claude/skills/kiro-*`                                | Discovery→Requirements→Design→Tasks→Impl→Review→Verify の 17 スキル                                                                   |
| 体制・運用（正本）     | `.kiro/steering/`                                      | `orchestration.md`（中核モデル）／`operations.md`（運用統治）／`role-catalog.md`（配役）／`review-checklists.md`／`README.md`（索引） |
| 判断基準（lazy）       | `.claude/rules/`                                       | パス連動で必要時だけ読む規約。実例は `_examples/`                                                                                     |
| 振り返り               | `.claude/reports/`                                     | 実装後の学びを記録し正本へ格上げ                                                                                                      |
| ガードレール           | `.claude/settings.json`                                | 破壊的操作の deny・作業系の allow                                                                                                     |
| 並行開発の道具         | `scripts/`                                             | `swarm-up.sh`／`swarm-down.sh`／`dev-dashboard.sh`                                                                                    |
| 可視化                 | `docs/status-dashboard.html`                           | 進行・体制・節目・KPI・PDCA を1枚に（中身は例・構造を再利用）                                                                         |
| プロダクト記憶（雛形） | `.kiro/steering/product.md`・`tech.md`・`structure.md` | 空テンプレ（記入して使う）                                                                                                            |

## 始め方（新規プロジェクト）

1. **複製**: このディレクトリを新プロジェクト名でコピーする。
2. **プロダクトを記入**: `product.md`・`tech.md`・`structure.md` を埋める（`/kiro-steering` で対話生成してもよい）。
3. **配役を確定**: `role-catalog.md` の標準キャスト（統括=統括／Engリーダー・Designリーダー=レーンリーダー／運用=運用／実装BE・実装FE・デザイン実装=Maker／EngRev・デザインRev=Checker／QA=QA）から、今回動かす役を選ぶ。候補ロスターは必要フェーズで投入。
4. **Discovery→仕様**: `/kiro-discovery "アイデア"` → `/kiro-spec-quick <feature>`（または個別スキル）で `.kiro/specs/<feature>/` を作る。各フェーズは人間承認。
5. **実装**: `/kiro-impl <feature>`。**規律A＝統括は実装せず、レーンリーダーの采配でワーカーが worktree 並行実装 → 独立レビューで受理**。
6. **可視化**: `docs/status-dashboard.html` を起点に進行を映す。**状態遷移トリガー**（着手→進行中→レビュー中→完了）で実施=統括が全体整合、担当=運用が監視。
7. **振り返り**: 節目で `.claude/reports/` に学びを残し、2 回目の判断は正本（steering／rules）へ格上げ。

## この手法の核（守るもの）

- **委譲規律 A〜E**（さぼり・肩代わり・隠蔽の防止＝信用を支える段取り）：`orchestration.md`
- **証拠で受理**（`kiro-verify-completion`）・**独立レビュー**（`kiro-review`）・**根本原因デバッグ**（`kiro-debug`）
- **信用を支える運用原則 P1〜P6**・**堅実性ファースト**（ノイズは削る／安全機構・判断根拠・開示・受理ゲートは削らない）
- **worktree 戦略**（ベース是正ガード：マーカー検証→欠ければ `git merge`・`reset --hard` は使わない）
- **開示は信用の通貨**：成功も失敗も再委譲も介入も開示する

## 経緯・継続

このテンプレートの**成り立ち・設計判断・次にできること・継続の作法**は [`.claude/reports/2026-06-29-origin-and-decisions.md`](.claude/reports/2026-06-29-origin-and-decisions.md) に記録。このディレクトリで作業を続けるときは、まずそれを読む。

## 注意

- ダッシュボードや steering 内の**固有名・数値・事故記号（A2/K1 等）は「例」**。教訓（なぜ）だけ受け取り、自分の実例に読み替える（各所に注記あり）。
- スタック依存の `.claude/rules/` は**実装が先・ルール化は後**で自分のスタック向けに作る（例は `_examples/`）。
- 外部ツール（agent-skills 等）の併用は「背骨を1つに絞る」（二重ツール＝理解負債を避ける）。
