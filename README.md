# conductor-sdlc-template

**AIエージェント主体の開発**を、コンダクター・オーケストレーション（メインのAIセッションが指揮役となり、複数のワーカーへ実装を割り振り独立レビューで受け取る体制）＋Kiro Spec-Driven Development（要件→設計→タスクの3段階承認で仕様化してから実装する進め方）＋可視化ダッシュボードで回すためのプロジェクト・テンプレート。実プロジェクト（（プロジェクト名））で確立した手法・体制・ノウハウ・ダッシュボードの骨格を、次のプロジェクトの起点として切り出したもの。

## すぐに始める

このテンプレートから新しいプロジェクトを作り、ダッシュボードが表示されるまで、コピペで数分。**Unix 系 / WSL 前提**（内部で bash を使う。Windows ネイティブは非対応）。

**前提を先に確認**（どちらも `nvm` なら sudo 不要で用意できる）:

- **Node.js 22.12 以上**（Astro 7 の要件）— `node -v` で確認。古い/未導入なら [nvm](https://github.com/nvm-sh/nvm) で `nvm install --lts`。
- **npm 10 以上** — `npm -v` で確認。**9 系以下だと `npx github:` が失敗する**（`could not determine executable to run`）。その場合も nvm で新しい Node を入れれば新しい npm が付いてくる。

```mermaid
flowchart LR
    S1["① 生成<br/>npx"] --> S2["② 依存取得<br/>npm install"]
    S2 --> S3["③ ビルド<br/>npm run build"]
    S3 --> S4["④ 確認<br/>npm run preview"]
```

リポジトリを clone しなくても、`npx` で新規プロジェクトを生成できる（内部で `scripts/init-project.sh` を実行）。`<生成先>` は**存在しない新規パス**、`"<プロジェクト名>"` は表示名（日本語可）。

```bash
npx github:kumamoto-kouki/conductor-sdlc-template ~/projects/my-app "マイアプリ"
cd ~/projects/my-app
npm install     # 依存取得（初回のみ）
npm run build   # 初期状態のダッシュボードを生成（生成物はGit管理外なので初回必須）
npm run preview # ブラウザで確認
```

**こうなれば成功**: `npm run preview` が `Local http://localhost:4321/` のような URL を表示する。開くと**節目 M0・仕様ゼロ件の初期状態ダッシュボード**が出る。（複数プロジェクトを並行して preview するときは、2つ目以降を `npm run preview -- --port 4322` のようにポートをずらす。）

<details>
<summary><b>バージョン固定 / clone 済みの場合 / うまくいかないとき</b>（クリックで展開）</summary>

- **バージョン固定**: 上記は常に `main`（最新）を取得する。再現性が要るときだけ末尾に git タグを付ける（例: `…conductor-sdlc-template#v0.10.0 …`。対応タグが `origin` に push 済みであること）。
- **clone 済みの場合**: リポジトリ内から `scripts/init-project.sh ~/projects/my-app "マイアプリ"` で同じ処理を直接実行できる。手動コピーや GitHub の `Use this template` ボタンでも代替可。
- **失敗の切り分け**（`npx` は「①npm が取得して bin 起動 → ②スクリプトが生成」の2段階。表示される `error:` 行が原因）:
  - `could not determine executable to run`（①）→ **npm が古い**（9 系以下）。nvm で 10 以上へ更新する。
  - `could not read Username for 'https://github.com'` / HTTP 404（①）→ **リポジトリが private**で匿名 clone 不可。Public 化するか認証情報を設定する。
  - `複製先ディレクトリを作成できませんでした` / `Permission denied`（②）→ 生成先の**親ディレクトリに書き込み権限がない**（例: root 所有の `/var/…` 配下を一般ユーザーで指定）。`~/projects/<name>` 等の書き込み可能なパスにする。
  - `複製先が既に存在します`（②）→ 同名ディレクトリが既存。**別の新規パス**にするか、既存を退避する（`npx` は新規パスにしか生成しない）。
  - `必須コマンドが見つかりません`（②）→ `rsync`/`git` 等が未導入。表示されたコマンドを入れる。

</details>

## インストール後にすること

ダッシュボードが表示できたら、**実装を始める前に運用パラメータを確定**する。後付けにすると「未定義のまま進めてドリフト（決めごとが曖昧なまま運用が個人差でぶれること）」の温床になる（実プロジェクトでの反省）。上から順に。

### 1. プロジェクト情報を記入（ステアリング）

- [ ] `.kiro/steering/` の **`product.md`・`tech.md`・`structure.md`** を記入する（`/kiro-steering` で対話生成も可）。
  - **なぜ**: これらは**ステアリング**（毎セッション自動で読み込まれるプロジェクト共通のメモ）として AI エージェントに常時渡る前提知識になる。空のままだと AI が前提を推測してドリフトする。

### 2. 規模を選び、配役を確定

- [ ] **規模プリセット（S/M/L）を選んでから配役を確定**する（`role-catalog.md` の「規模別プリセット」）。
  - **なぜ**: 標準キャスト（統括・Eng/Design リーダー・実装/デザイン担当＝Maker・EngRev/デザインRev＝Checker・QA）から今回動かす役を決めないと、誰が実装し誰が検査するか（**Maker≠Checker**、規律C）が曖昧になる。

### 3. 運用パラメータを確定

- [ ] **WIP 上限・整合の担当・ID 体系**を決める（既定: レビュー中の WIP 上限＝3／整合の実施＝統括・担当＝運用／ID 体系＝M＝節目専用・K＝繰越・D＝デザイン・V＝目視）。
  - **なぜ**: 節目 ID とタスク ID が衝突すると、どの ID が何を指すか事後に読み解けなくなる事故が実際に起きた。

### 4. 技術セットアップの最終確認

- [ ] **`npm install` 済み**（Astro・Mermaid・Tailwind 等。**Node.js 22.12+** が前提）。
- [ ] **`dashboard/status.json` を確認して `npm run build` 済み**（v0.4.0 以降ダッシュボードの生成物は Git 管理外なので、初回は必ず自分でビルドしないと画面に何も出ない）。
- [ ] **`git config core.hooksPath .githooks` 済み**（`npx`/`init-project.sh` 経由の生成では自動設定済み。既存リポジトリへ後付け導入した場合だけ手動実行。設定しないと `status.json` の入力ミスを検知する pre-commit フックが働かない）。

### 5. 最初の機能を作り始める

準備ができたら、対象プロジェクトのディレクトリで Claude Code を開き、SDLC を1周回す（各フェーズの承認は人間＝PO が行う）:

1. **`/kiro-discovery "アイデア"`** — アイデアを整理し、単一/複数スペックの方針を決める
2. **`/kiro-spec-quick {feature}`** — 要件 → 設計 → タスク（3段階承認）
3. **`/kiro-impl {feature}`** — worktree で並行実装 → 独立レビュアーが受理判定
4. **`dashboard/status.json` を更新 → `npm run build`** で進捗を反映

進行中はいつでも **`/kiro-spec-status {feature}`** で状況を確認できる。全体像は次の「全体の流れ」を参照。

## 全体の流れ（1周）

複製してから機能が1つ育ってダッシュボードに反映されるまでの1周は次のとおり。人間（PO＝プロダクトオーナー）が承認するポイントを色つきで示す。

```mermaid
flowchart TD
    A[プロジェクトを複製] --> B["product.md 等に<br/>プロジェクト情報を記入"]
    B --> C["アイデアを整理<br/>/kiro-discovery"]
    C --> D["仕様を作成<br/>/kiro-spec-quick<br/>要件 → 設計 → タスク"]
    D --> E{{"人間(PO)が<br/>各フェーズを承認"}}
    E -->|承認| F["実装<br/>/kiro-impl（worktreeで並行）"]
    F --> G[独立レビュアーが受理判定]
    G -->|FAIL| F
    G -->|PASS| H[統合ブランチへ統合]
    H --> I["dashboard/status.jsonを更新して<br/>npm run buildで反映"]
    I --> J{{"mainへのpush・公開は<br/>人間(PO)が判断"}}
    J -.次の機能へ.-> C

    classDef human fill:#fff3cd,stroke:#856404,color:#664d03,stroke-width:2px
    class E,J human
```

**worktree**（同じgitリポジトリを複数の作業ディレクトリへ同時展開し、並行実装時のファイル衝突を防ぐ仕組み）を使い、複数の実装が同時並行で進む。承認は人が行い、それ以外の受理判定（独立レビュー）は仕組みで回す。

## 体制（誰が何をするか）

実装する人（Maker）と検査する人（Checker）は必ず別にする（自己レビュー禁止）。

```mermaid
flowchart TD
    PO["🧑🏻‍💼 PO（人間）<br/>大方針・承認・公開判断"]
    K["👨🏼‍💼 統括（コンダクター）<br/>采配は委譲・自分では実装しない"]
    LE["🧑🏼‍💼 Engリーダー<br/>エンジニアリングの采配"]
    LD["🧑🏼‍🎨 Designリーダー<br/>デザインの采配"]
    ME["👨🏼‍💻 実装担当（Maker）<br/>worktreeで並行実装"]
    MD["👩🏼‍🎨 デザイン実装（Maker）"]
    RE["🛡️ EngRev（Checker）<br/>実装者と別人が受理判定"]
    RD["🕵🏼‍♀️ デザインRev（Checker）<br/>実装者と別人が受理判定"]
    OPS["👩🏼‍💼 運用<br/>状態が実態と合っているか監視"]

    PO --> K
    K --> LE --> ME --> RE --> K
    K --> LD --> MD --> RD --> K
    OPS -. 健全性を監視 .- K

    classDef maker fill:#d1e7dd,stroke:#0f5132,color:#0f5132
    classDef checker fill:#f8d7da,stroke:#842029,color:#842029
    class ME,MD maker
    class RE,RD checker
```

## 画面で進捗を見る

進捗の唯一の真実は `dashboard/status.json` で、これを Astro（静的サイト生成ツール）がビルド時にHTMLへ変換する。**`dashboard/status-dashboard.html` はビルド生成物であり手編集しない**。

```mermaid
flowchart LR
    A["dashboard/status.jsonを編集"] --> B["コミット<br/>（pre-commitがスキーマ検証）"]
    B --> C["npm run build<br/>（HTMLを生成）"]
    C --> D["npm run preview<br/>（ブラウザで確認）"]
```

- 状態を変えたら（着手・進行中・レビュー中・完了）その都度 `status.json` を編集してコミットする。コミット時に pre-commit フックが `src/lib/schema.mjs` のスキーマで検証し、必須フィールドの欠落など明らかな入力ミスをその場でブロックする。
- 見るときは `npm run build` → `npm run preview` を実行し、表示された URL をブラウザで開く（**正式な閲覧方式**）。`npm run preview` は既にある生成物を配信するだけで自動ビルドしないため、生成物が無い・古い場合は先に `npm run build` を行う。
- `dashboard/status-dashboard.html` を `file://` で直接開くこともできるが、その場合は Mermaid 図が実描画されない（進捗・ボード・KPI 等のテキスト情報は読める）**フォールバック表示**になる。

## 中身の地図

```mermaid
flowchart TD
    ROOT["リポジトリ直下"]
    ROOT --> KIRO[".kiro/<br/>steering（常時参照のルール）<br/>specs/機能名/（機能ごとの仕様）"]
    ROOT --> SKILLS[".claude/skills/<br/>SDLCの手順（17スキル）"]
    ROOT --> RULESD[".claude/rules/<br/>パス連動の判断基準"]
    ROOT --> PLAYBOOKS[".claude/playbooks/<br/>委譲・還流の雛形"]
    ROOT --> REPORTSD[".claude/reports/<br/>実装後の振り返り"]
    ROOT --> SETTINGSD[".claude/settings.json<br/>権限ガードレール"]
    ROOT --> SCRIPTSD["scripts/<br/>複製・並行開発・検証ツール"]
    ROOT --> DASHBOARDD["dashboard/ + src/<br/>進捗ダッシュボード（Astro）"]
    ROOT --> DOCSD["docs/<br/>ドキュメント専用"]
```

| 要素                   | 場所                                                   | 内容                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDLC エンジン          | `.claude/skills/kiro-*`                                | Discovery→Requirements→Design→Tasks→Impl→Review→Verify の 17 スキル                                                                                                                                                              |
| 体制・運用（正本）     | `.kiro/steering/`                                      | `orchestration.md`（中核モデル）／`operations.md`（運用統治）／`role-catalog.md`（配役）／`review-checklists.md`／`README.md`（索引）                                                                                            |
| 判断基準（lazy）       | `.claude/rules/`                                       | パス連動で必要時だけ読む規約。実例は `_examples/`                                                                                                                                                                                |
| プレイブック           | `.claude/playbooks/`                                   | `delegation.md`（委譲雛形）／`knowledge-graph.md`（大規模化判断）／`full-sdlc.md`（超上流〜保守運用マッピング）／`template-feedback.md`（テンプレへの還流）／`testing-strategy.md`（テスト戦略・フレームワーク非依存の判断基準） |
| セッション報告         | `.claude/reports/`                                     | 作業メモ・中間レポート。恒久内容は書いた時点で `CHANGELOG.md`／正本へ直接記録し、レポート自体は随時削除できる                                                                                                                    |
| ガードレール           | `.claude/settings.json`                                | 破壊的操作の deny・作業系の allow                                                                                                                                                                                                |
| 並行開発の道具         | `scripts/`                                             | `swarm-up.sh`／`swarm-down.sh`／`dev-dashboard.sh`                                                                                                                                                                               |
| セットアップ・還流     | `scripts/`・`VERSION`                                  | `init-project.sh`（複製・初期化）／`collect-template-feedback.sh`（派生プロジェクトからの知見収集）                                                                                                                              |
| 可視化                 | `dashboard/`＋`src/`（Astro）                          | `status.json`（唯一の真実）＋Astro（`npm install`＋`npm run build`）でHTML生成。生成物自体はGit管理外（後述）。`docs/` はドキュメント専用に分離                                                                                  |
| プロダクト記憶（雛形） | `.kiro/steering/product.md`・`tech.md`・`structure.md` | 空テンプレ（記入して使う）                                                                                                                                                                                                       |

## この進め方のルール

**委譲規律 A〜E**（実装を任せる・任された側が受け取る、それぞれの局面での判断基準。正本は `.kiro/steering/orchestration.md`）を平易に書くと次のとおり。

- **A（委譲原則）**：新機能や複数ファイルにまたがる作業は、隔離された作業コピー（**worktree**）で動く実装エージェントへ任せる。1〜2行の typo 修正のような軽微な変更だけ統括が直接行う。
- **B（証拠で受理）**：「できました」という報告だけで完了にしない。統括がテスト・ビルドを自分で再実行し、仕様の完了条件を機械的に満たすことを確認してから受理する（`kiro-verify-completion`）。
- **C（独立レビュー）**：実装した人（Maker）と検査する人（Checker）は必ず別にする（自己レビュー禁止、`kiro-review`）。
- **D（肩代わりは黙ってやらない）**：実装が詰まったら根本原因を調べる（`kiro-debug`）か別の担当へ委譲し直す。どうしても統括が代わりに手を動かす場合は、その旨を記録に残し完了報告で開示する。
- **E（開示台帳）**：委譲・レビュー判定・介入を記録し、成功だけでなく失敗・再委譲・介入も報告する。短い完了報告だけを信用せず証拠と突き合わせる。

そのほかの土台:

- **worktree 戦略（ベース是正ガード）**：実装エージェントが作業を始める前に、既存の成果物が本当に存在するかをマーカーファイル等で機械的に検証する。欠けていれば `git merge` で最新を取り込んでからやり直す（`git reset --hard` は破壊的操作なので使わせない）。詳細は `orchestration.md`。
- **信用を支える運用原則（P1〜P6）と堅実性ファースト**：ノイズは削ってよいが、安全機構・判断根拠・開示・受理ゲートは削らない。詳細は `orchestration.md`。
- **振り返りを記録する**：節目ごとに `.claude/reports/`（セッションメモ）へ振り返りを残す。バージョン記録・持ち越し事項は書いた時点で `CHANGELOG.md` へ、2回目以降も同じ判断を下す場面が来た学びは正本（`.kiro/steering/`・`.claude/rules/`）へ、それぞれ直接記録する。
- **大規模化したらナレッジグラフ化を検討する**：依存関係を横断する質問（「この変更は何に影響するか」等）が頻発しだしたら `.claude/playbooks/knowledge-graph.md`（判断基準・手法マトリクス・導入手順）を参照する。

## 困ったとき・FAQ

- **Q. `npm install` が失敗する／Astroが動かない**
  A. Node.js のバージョンを確認する（`node -v`）。Astro 7 は **Node.js 22.12 以上**を要求する。バージョンマネージャ（nvm 等）で切り替えてから再実行する。
- **Q. ダッシュボードを開いても古い内容のまま**
  A. `dashboard/status-dashboard.html` はビルド生成物であり、`status.json` を編集しただけでは自動更新されない。`npm run build` を実行してから `npm run preview` で開き直す。
- **Q. コミットしようとしたら pre-commit フックに止められた**
  A. `dashboard/status.json`（または `status.init.json`）のスキーマ検証に失敗している。フックが出すエラーメッセージ（欠落フィールド名等）を読んで修正する。緊急時のみ `git commit --no-verify` で迂回できるが非推奨（検証をすり抜けたまま壊れた状態がコミットされる）。
- **Q. Mermaid 図が表示されない**
  A. GitHub・VSCode 上で見ている場合は自動描画される。ダッシュボードを `file://` で直接開いた場合は Mermaid の実描画をフォールバック表示に格下げしている仕様（正式な閲覧は `npm run preview`）。正式閲覧に切り替えれば描画される。
- **Q. `scripts/init-project.sh` が「複製先が既に存在します」で失敗する**
  A. 複製先ディレクトリが既に存在すると上書きを避けるため停止する。別のパスを指定するか、既存ディレクトリを退避してから再実行する。

## 経緯・注意

このテンプレートの**成り立ち・設計判断・バージョンごとの変更**は [`CHANGELOG.md`](CHANGELOG.md) に記録。このディレクトリで作業を続けるときは、まずそれを読む。

**v0.4.0** でダッシュボードのビルド生成物（`dashboard/*.html`・`_astro/`・`reports/`・`steering/`）を Git 管理外にした。生成物を都度コミットする運用は「入力（`status.json`）とビルド出力が食い違う」事故の温床になっており、生成物を管理外にして毎回ビルドし直す運用へ変更した（トレードオフ＝クローン直後に `file://` で即閲覧できていた利便性を失う。「すぐに始める」の `npm install`＋`npm run build` を必須の初手として受け入れる）。詳細は `CHANGELOG.md` の `[0.4.0]` を参照。

- ダッシュボードや steering 内の**固有名・数値・事故記号（A2/K1 等）は「例」**。教訓（なぜ）だけ受け取り、自分の実例に読み替える（各所に注記あり）。
- スタック依存の `.claude/rules/` は**実装が先・ルール化は後**で自分のスタック向けに作る（例は `_examples/`）。
- 外部ツール（agent-skills 等）の併用は「背骨を1つに絞る」（二重ツール＝理解負債を避ける）。
