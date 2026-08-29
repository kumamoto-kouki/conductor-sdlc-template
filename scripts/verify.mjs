#!/usr/bin/env node
// テンプレートの整合性検証ハーネス。
//   使い方: node scripts/verify.mjs   （または npm run verify）
//
// v0.12.0 でダッシュボード（Astro）を撤去したため、描画・決定性・要素数など
// 生成 HTML を対象にしていた6つのチェックは検証対象そのものが消えた。
// personas.json と dashboard/status.json も撤去したため、それらとの整合チェック
// （旧6・旧7）も対象が消えた。残ったのは「文書どうしの整合」を守る2つと、
// 新たに必要になった「STATUS.md が実態と一致しているか」の1つである。
//
// 依存パッケージなし（node標準のみ）。1つの失敗で止めず、すべてのチェックを
// 実行してから合否をまとめて報告する。
// ✅=合格 ❌=失敗（exit 1の原因） ⚠=要確認だが失敗扱いにしない ⏭=環境要因でスキップ。

import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GITIGNORE = join(ROOT, ".gitignore");
const TEMPLATE_GITIGNORE = join(ROOT, "template.gitignore");
const PACKAGE_SCAFFOLD_JSON = join(ROOT, "package.scaffold.json");

const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon =
    status === "pass"
      ? "✅"
      : status === "fail"
        ? "❌"
        : status === "warn"
          ? "⚠"
          : "⏭";
  console.log(`${icon} ${name}`);
  if (detail) {
    console.log(
      detail
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n"),
    );
  }
  console.log("");
}

// ---- 1. AI向けドキュメントのリポジトリ相対参照の実在検証 ----
// (AI が読む文書が存在しないパスを指していると、参照先を読めないまま作業が進み、
//  誤った前提で成果物が作られる。バックティックで囲まれ、かつリポジトリ相対と
//  明確に分かる参照だけに絞る。裸のファイル名参照やスキル相対参照、spec 生成物
//  まで対象にすると誤検知が大量に出て、チェック自体が無視されるようになるため。
//  プレースホルダ・テンプレ記法（<...>・*・{...}・$...・（...）を含むもの）も除外する。)
const DOC_REF_TARGET_PATTERN =
  /^(CLAUDE\.md|README\.md|\.claude\/|\.kiro\/|docs\/)/;
const DOC_REF_PATTERN =
  /`((?:\.claude|\.kiro|\.githooks|scripts|docs|bin)\/[^`\s]+(?:\.(?:md|mjs|json|sh))?)`/g;
// Markdown リンク記法 `[表示](path)` も検査する。バッククォート囲みだけを見ていると、
// 文書中のリンクが切れても気づけない（実測時点で本体に11件存在）。
const DOC_LINK_PATTERN =
  /\]\((?!https?:|#|mailto:)([^)\s]+\.(?:md|mjs|json|sh))\)/g;
const DOC_REF_PLACEHOLDER_CHARS = /[<>*{}$（）[\]]/;
// 許可リスト（実在しなくてよい参照）: .kiro/steering/roadmap.md は
// /kiro-discovery が複数spec構成のプロジェクトで生成する成果物であり、
// テンプレート状態のリポジトリには存在しないのが正常なため除外する。
const DOC_REF_ALLOWLIST = new Set([".kiro/steering/roadmap.md"]);
// 生成プロジェクトでのみ実在しなくてよい参照。scripts/init-project.sh は npx 入口である
// bin/ を複製先へ配らない（生成プロジェクトはスキャフォルダではないため）。テンプレート
// 本体では実在を要求し、生成側でのみ許可する。無条件の許可リストに入れると、テンプレート
// 本体で bin/create.mjs を壊しても検知できなくなる。
const DOC_REF_SCAFFOLD_ONLY = new Set(["bin/create.mjs"]);

/** そのパスが .gitignore の対象か。git が使えない場合は false（＝欠落として報告）。 */
function isIgnored(ref) {
  const r = spawnSync("git", ["check-ignore", "-q", "--", ref], { cwd: ROOT });
  return r.status === 0;
}

function checkDocReferencesExist() {
  const NAME = "1. AI向けドキュメントのリポジトリ相対参照の実在検証";
  const isTemplateBody = existsSync(PACKAGE_SCAFFOLD_JSON);
  // git が使えない環境（zip 配布・.git 削除・git 未インストール）でここが例外死すると、
  // git を必要としない他の4チェックまで巻き添えで実行されなくなる。ヘッダに書いた
  // 「1つの失敗で止めず全チェックを実行する」という設計が最初のチェックで破れる。
  let files;
  try {
    files = execSync("git ls-files '*.md'", { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .filter((f) => DOC_REF_TARGET_PATTERN.test(f));
  } catch {
    record(
      NAME,
      "skip",
      "git を実行できないためスキップ（このチェックは追跡ファイルの一覧に git を使う）。他のチェックは続行します。",
    );
    return;
  }

  let total = 0;
  const missing = [];
  const vanished = [];
  for (const f of files) {
    // git の index にあるがディスクに無いファイル（削除をステージしていない・
    // 作業ツリーが壊れている等）。ここで例外死するとハーネス全体が止まり、
    // 他のチェックの結果も見えなくなるため、失敗として記録して続行する。
    if (!existsSync(join(ROOT, f))) {
      vanished.push(f);
      continue;
    }
    const lines = readFileSync(join(ROOT, f), "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const pat of [DOC_REF_PATTERN, DOC_LINK_PATTERN]) {
        const re = new RegExp(pat);
        let m;
        while ((m = re.exec(lines[i]))) {
          const ref = m[1];
          if (DOC_REF_PLACEHOLDER_CHARS.test(ref)) continue;
          total++;
          if (DOC_REF_ALLOWLIST.has(ref)) continue;
          if (!isTemplateBody && DOC_REF_SCAFFOLD_ONLY.has(ref)) continue;
          // リンクは書かれた文書からの相対パス。リポジトリ相対でも解決を試す。
          const fromDoc = join(ROOT, dirname(f), ref);
          if (existsSync(join(ROOT, ref)) || existsSync(fromDoc)) continue;
          // gitignore されているパスは実行時に作られる状態（worktree・進捗ログ等）で、
          // 存在しないのが正常な場面がある。テンプレート本体には偶然あって生成
          // プロジェクトには無い、という「生成側でのみ落ちる」差の温床でもある。
          if (isIgnored(ref)) continue;
          missing.push(`${f}:${i + 1} -> ${ref}`);
        }
      }
    }
  }

  if (vanished.length > 0) {
    record(
      NAME,
      "fail",
      `git の index にあるがディスクに存在しないファイルがあります（削除をステージしていない可能性）:\n` +
        vanished.join("\n"),
    );
    return;
  }
  if (missing.length === 0) {
    record(
      NAME,
      "pass",
      `${files.length} ファイル走査・明確な相対参照 ${total} 件のうち実在しないもの0件（許可リスト適用後${isTemplateBody ? "・テンプレート本体として検証" : "・生成プロジェクトとして検証＝bin/ の不在を許容"}）`,
    );
  } else {
    record(NAME, "fail", missing.join("\n"));
  }
}

// ---- 2. .gitignore ⇔ template.gitignore 双子drift検知 ----
// (npm はパッキング時に .gitignore を tarball から常時除外する（.npmignore を足しても
//  .gitignore 自体が除外されたままなので解決しない）。この制約を避けるため、npx 経由の
//  複製では template.gitignore という別名の双子ファイルを配り、scripts/init-project.sh が
//  複製先で .gitignore へリネームする。2ファイルは常に同一内容でなければならない双子であり、
//  片方だけを更新すると複製先の .gitignore がテンプレ本体と乖離するため検知する。)
function checkGitignoreTwinConsistency() {
  const NAME = "2. .gitignore ⇔ template.gitignore 双子drift検知";
  // このチェックはテンプレート本体専用。生成プロジェクトには template.gitignore が
  // 存在しないのが正常なのでスキップするが、「テンプレート本体でもない」ことを
  // package.scaffold.json の不在で確認してからスキップする。テンプレート本体で
  // template.gitignore を誤って削除した場合まで素通りさせないため。
  //
  // 既知の限界（対応不要）: この判別は package.scaffold.json 自身の実在に依存する。
  // package.scaffold.json が誤って削除された場合は生成プロジェクトと誤認して skip へ落ちる。
  const isTemplateBody = existsSync(PACKAGE_SCAFFOLD_JSON);
  if (!existsSync(TEMPLATE_GITIGNORE)) {
    if (isTemplateBody) {
      record(
        NAME,
        "fail",
        `template.gitignore が見つかりません（${TEMPLATE_GITIGNORE}）。このリポジトリはテンプレート本体（${PACKAGE_SCAFFOLD_JSON} が存在）である。template.gitignore の不在は生成プロジェクトでは正常だが、ここはテンプレート本体なので正常な不在として扱えない。誤って削除・移動していないか確認すること。`,
      );
      return;
    }
    record(
      NAME,
      "skip",
      "template.gitignore が無いためスキップ（テンプレート本体専用のチェック。生成プロジェクトでは scripts/init-project.sh が複製時に .gitignore へリネームするため存在しないのが正常。package.scaffold.json も存在しないことを確認済み）",
    );
    return;
  }
  if (!existsSync(GITIGNORE)) {
    record(NAME, "fail", `.gitignore が見つかりません（${GITIGNORE}）`);
    return;
  }
  if (
    readFileSync(GITIGNORE, "utf8") === readFileSync(TEMPLATE_GITIGNORE, "utf8")
  ) {
    record(NAME, "pass", ".gitignore と template.gitignore の内容が完全一致");
  } else {
    record(
      NAME,
      "fail",
      ".gitignore と template.gitignore の内容が一致しません。npm は .gitignore を tarball から常時除外するため、npx 経由の複製先には template.gitignore の内容が届きます。" +
        "どちらを直すべきか判断し（通常は最後に編集した方が正）、2ファイルを同一内容にしてください（例: cp .gitignore template.gitignore）。",
    );
  }
}

// ---- 3. STATUS.md が実態と一致 ----
// (STATUS.md は scripts/status-report.mjs が spec.json・tasks.md・role-catalog.md から
//  導出する。手で書く欄を持たないため内容が嘘になることは無いが、「導出元が変わったのに
//  再生成していない」状態は起こりうる。旧 dashboard/status.json はまさにこれで、
//  テンプレート本体では実在しない spec を 4 件、生成プロジェクトでは実在する spec を
//  0 件と表示したまま、誰も気づかなかった。生成器は決定性があるため、再生成して
//  差分が出るかどうかで陳腐化を機械判定できる。)
function checkStatusReportFresh() {
  const NAME = "3. STATUS.md が実態と一致（再生成しても差分が出ないこと）";
  const r = spawnSync(
    process.execPath,
    [join(ROOT, "scripts", "status-report.mjs"), "--check"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (r.status === 0) {
    record(NAME, "pass", (r.stdout || "").trim());
  } else {
    record(
      NAME,
      "fail",
      `${(r.stderr || r.stdout || "").trim()}\n（.kiro/specs/ や .kiro/steering/role-catalog.md を変更したら npm run status を実行すること）`,
    );
  }
}

// ---- 4. .kiro/specs/*/spec.json が状況の導出元として読める ----
// (spec.json が壊れると、その仕様は STATUS.md から静かに消える。これは撤去した
//  dashboard/status.json が「実在する spec を 0 件と表示したまま誰も気づかなかった」
//  のと同じ失敗モードである。STATUS.md 本文にも「読み取れなかった仕様」として出るが、
//  CI や pre-commit を通さない経路でも気づけるよう、ここでも独立に判定する。)
function checkSpecJsonReadable() {
  const NAME = "4. .kiro/specs/*/spec.json が状況の導出元として読める";
  const dir = join(ROOT, ".kiro", "specs");
  if (!existsSync(dir)) {
    record(NAME, "skip", ".kiro/specs/ がまだありません（仕様の作成前）");
    return;
  }
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (names.length === 0) {
    record(NAME, "skip", ".kiro/specs/ に仕様ディレクトリがありません");
    return;
  }
  const bad = [];
  for (const name of names) {
    const f = join(dir, name, "spec.json");
    if (!existsSync(f)) {
      bad.push(`${name}: spec.json がありません`);
      continue;
    }
    try {
      const j = JSON.parse(readFileSync(f, "utf8"));
      if (!j || typeof j !== "object")
        throw new Error("オブジェクトではありません");
      if (!j.approvals || typeof j.approvals !== "object") {
        throw new Error("approvals フィールドがありません");
      }
    } catch (e) {
      bad.push(`${name}: ${e.message}`);
    }
  }
  if (bad.length === 0) {
    record(NAME, "pass", `${names.length} 件の仕様すべてを読み取れます`);
  } else {
    record(
      NAME,
      "fail",
      `次の仕様は STATUS.md から静かに脱落します:\n${bad.join("\n")}`,
    );
  }
}

// ---- 5. VERSION ⇔ package.json の version 一致 ----
// (VERSION はリリース版の記録で、scripts/init-project.sh が複製先の TEMPLATE_VERSION
//  に写して派生元の追跡に使う。package.json だけ上げて VERSION を上げ忘れると、
//  そのタグから生成したプロジェクトが誤った派生元バージョンを記録する。実際に
//  v0.11.0 のリリースコミットで漏れ、公開後に発覚した（履歴は訂正できなかった）。
//  人の記憶に頼らずここで機械的に突き合わせる。)
function checkVersionConsistency() {
  const NAME = "5. VERSION ⇔ package.json の version 一致";
  const vf = join(ROOT, "VERSION");
  const pf = join(ROOT, "package.json");
  if (!existsSync(vf)) {
    record(NAME, "skip", "VERSION がありません");
    return;
  }
  if (!existsSync(pf)) {
    record(NAME, "fail", "package.json がありません");
    return;
  }
  const v = readFileSync(vf, "utf8").trim();
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pf, "utf8"));
  } catch (e) {
    record(NAME, "fail", `package.json を読めません: ${e.message}`);
    return;
  }
  if (v === pkg.version) {
    record(NAME, "pass", `どちらも ${v}`);
  } else {
    record(
      NAME,
      "fail",
      `VERSION は ${v}、package.json は ${pkg.version} で一致しません。` +
        "どちらかの更新が漏れています（VERSION はリリース版の記録で、生成プロジェクトの TEMPLATE_VERSION の元になる）。",
    );
  }
}

// ---- 6. pre-commit フックが有効になっているか ----
// (git は core.hooksPath をクローンへ引き継がない。生成プロジェクトを clone した
//  第三者・CI・2台目の環境ではフックが一切効かず、STATUS.md が自動再生成されない。
//  症状は「コミットしたのに STATUS.md が古い」＝チェック3の失敗として現れるが、
//  原因がフック不在だと分からないと直しようがない。git の仕様なので防げないが、
//  検知して直し方を出すことはできる。失敗ではなく警告にする——クローン直後に
//  未設定なのは異常ではなく、1コマンドで直るため。)
function checkHooksEnabled() {
  const NAME = "6. pre-commit フックが有効（STATUS.md の自動再生成）";
  const inRepo = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: ROOT });
  if (inRepo.status !== 0) {
    record(NAME, "skip", "git リポジトリではないためスキップ");
    return;
  }
  const r = spawnSync("git", ["config", "core.hooksPath"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const configured = (r.stdout || "").trim();
  if (!existsSync(join(ROOT, ".githooks", "pre-commit"))) {
    record(NAME, "skip", ".githooks/pre-commit がありません");
    return;
  }
  if (configured.endsWith(".githooks")) {
    record(NAME, "pass", `core.hooksPath = ${configured}`);
    return;
  }
  record(
    NAME,
    "warn",
    "core.hooksPath が .githooks を指していません。git はこの設定をクローンへ引き継がないため、" +
      "クローンした環境では STATUS.md が自動再生成されません（コミット後に古いままになります）。\n" +
      "次を1度実行してください: git config core.hooksPath .githooks",
  );
}

// ---- 7. 常時ロードの予算 ----
// (`CLAUDE.md` と `.kiro/steering/*.md` は毎セッション丸ごとモデルへ渡る。ここは
//  「あれば便利」を置く場所ではなく、毎ターンのコストと注意を消費する固定費である。
//  Agent = Model + Harness という見方では、環境の質はモデルの賢さと同格に効き、
//  読ませる量はその環境設計の一部になる。放っておくと単調に増える——実測で、棚卸し
//  直後 68,658 バイトから 83,597 バイトまで戻った（+21.8%）ことがある。
//  そこで予算を宣言し、超えたら止める。増やしたいときは、この定数を上げるという
//  意識的な操作を要求する——それが「黙って増える」を「決めて増やす」に変える。
//  条件付きでよい内容は `.claude/rules/`（glob 一致時のみ）か、そのスキルが必要な
//  ときに読む場所へ置く。
//
//  予算は二本立てにする。生成プロジェクトでは kiro-onboard / kiro-steering が
//  product.md・tech.md・structure.md へプロジェクト自身の内容（不変条件・制約・
//  構成）を記入する——それは書くべきものであって、テンプレート水準の予算で
//  縛ってはならない。初版はここが単一の 32,000 で、空テンプレ時点の残りが 897 字
//  しかなく、オンボーディング直後から生成側の verify が恒常的に落ちる欠陥だった
//  （「テンプレ本体で通るが生成側で落ちる」類型の3件目。.claude/rules/verification.md）。)
const CONTEXT_BUDGET_CHARS_TEMPLATE = 32000;
const CONTEXT_BUDGET_CHARS_PROJECT = 44000;

function checkContextBudget() {
  const isTemplateBody = existsSync(PACKAGE_SCAFFOLD_JSON);
  const CONTEXT_BUDGET_CHARS = isTemplateBody
    ? CONTEXT_BUDGET_CHARS_TEMPLATE
    : CONTEXT_BUDGET_CHARS_PROJECT;
  const NAME = `7. 常時ロードの予算（CLAUDE.md ＋ .kiro/steering/・${
    isTemplateBody ? "テンプレート本体" : "生成プロジェクト"
  }水準）`;
  const files = [join(ROOT, "CLAUDE.md")];
  const steeringDir = join(ROOT, ".kiro", "steering");
  if (existsSync(steeringDir)) {
    for (const f of readdirSync(steeringDir).sort()) {
      if (f.endsWith(".md")) files.push(join(steeringDir, f));
    }
  }
  const present = files.filter((f) => existsSync(f));
  if (present.length === 0) {
    record(NAME, "skip", "CLAUDE.md も .kiro/steering/*.md も見つかりません");
    return;
  }
  let chars = 0;
  const rows = [];
  for (const f of present) {
    const n = [...readFileSync(f, "utf8")].length;
    chars += n;
    rows.push([n, f.slice(ROOT.length + 1)]);
  }
  rows.sort((a, b) => b[0] - a[0]);
  const top = rows
    .slice(0, 3)
    .map(([n, f]) => `${f} ${n.toLocaleString()}`)
    .join(" / ");
  if (chars <= CONTEXT_BUDGET_CHARS) {
    record(
      NAME,
      "pass",
      `${chars.toLocaleString()} / ${CONTEXT_BUDGET_CHARS.toLocaleString()} 文字（残り ${(CONTEXT_BUDGET_CHARS - chars).toLocaleString()}）。大きい順: ${top}`,
    );
    return;
  }
  record(
    NAME,
    "fail",
    `${chars.toLocaleString()} 文字で、予算 ${CONTEXT_BUDGET_CHARS.toLocaleString()} を ${(chars - CONTEXT_BUDGET_CHARS).toLocaleString()} 超えています。\n` +
      `大きい順: ${top}\n` +
      `条件付きでよい内容を .claude/rules/（glob 一致時のみ読まれる）か、必要なスキルが読む場所へ移してください。\n` +
      `本当に毎セッション必要なら scripts/verify.mjs の ${
        isTemplateBody
          ? "CONTEXT_BUDGET_CHARS_TEMPLATE"
          : "CONTEXT_BUDGET_CHARS_PROJECT"
      } を上げること——ただしそれは「決めて増やす」操作であり、理由をコミットメッセージに残すこと。`,
  );
}

// ---- 8. 委譲プロンプトに権限境界のガードが入っているか ----
// (`.kiro/steering/orchestration.md` は「push は人間だけ」「統合は統括だけ」と定めるが、
//  正本に書いてあることは、実際に送られる文面に入っていなければ発火しない——これは
//  `.claude/playbooks/delegation.md` §0 が 2026-07-02 の事故から得た教訓そのもので、
//  そのときの原因は「正本に書いてあるが委譲プロンプトで毎回引用しなかった」だった。
//  実測（2026-08-24）：kiro-impl が実際に送る3つのプロンプトのいずれにも `git push`
//  の禁止が書かれていなかった。文章での約束は、機械で見ないと同じ形で抜ける。)
// 対象はハードコードせず、テンプレート命名規約（*-prompt.md）で自動収集する。
// 固定リストだと、新しい委譲テンプレを追加しても検査対象に入らない（監査指摘）。
function dispatchedPrompts() {
  const out = [];
  const skillsDir = join(ROOT, ".claude", "skills");
  if (!existsSync(skillsDir)) return out;
  for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!skill.isDirectory()) continue;
    const tpl = join(skillsDir, skill.name, "templates");
    if (!existsSync(tpl)) continue;
    for (const f of readdirSync(tpl)) {
      if (f.endsWith("-prompt.md")) {
        out.push(join(".claude", "skills", skill.name, "templates", f));
      }
    }
  }
  return out.sort();
}
const REQUIRED_GUARDS = [
  { label: "push の禁止", re: /git push/ },
  { label: "権限ファイルの変更禁止", re: /\.claude/ },
];

function checkDelegationGuards() {
  const NAME = "8. 委譲プロンプトに権限境界のガードが入っている";
  const missing = [];
  let checked = 0;
  const prompts = dispatchedPrompts();
  if (prompts.length === 0) {
    record(NAME, "skip", "*-prompt.md テンプレートが見つかりません");
    return;
  }
  for (const rel of prompts) {
    const f = join(ROOT, rel);
    if (!existsSync(f)) {
      missing.push(`${rel}: ファイルがありません`);
      continue;
    }
    checked++;
    const text = readFileSync(f, "utf8");
    for (const g of REQUIRED_GUARDS) {
      if (!g.re.test(text))
        missing.push(`${rel}: ${g.label} が書かれていません`);
    }
  }
  if (missing.length === 0) {
    record(
      NAME,
      "pass",
      `${checked} 本のプロンプトすべてに ${REQUIRED_GUARDS.length} 種のガードが入っています`,
    );
    return;
  }
  record(
    NAME,
    "fail",
    missing.join("\n") +
      "\n正本（orchestration.md の権限境界）に書いてあっても、送られる文面に無ければ発火しません。" +
      "\n判断基準は .claude/playbooks/delegation.md §0・§2.5 を参照してください。",
  );
}

// ---- 9. 承認の完全性（承認済み文書の事後改変の検知） ----
// (承認は spec.json の真偽値だけで、初版は「何を承認したか」を持っていなかった。
//  承認後に requirements.md 等を書き換えても approved: true が残る——「承認済み事項の
//  切り下げ」は実際に統括と設計担当の双方で起きた事故類型なのに、防御が散文しか
//  無かった。/kiro-approve と -y 経路は承認時に対象文書の SHA-256 を
//  approvals.<phase>.approved_sha256 として記録する。ここでは現文書のハッシュを
//  再計算し、不一致なら fail する。ハッシュの無い承認（旧データ）は skip（後方互換）。
//  これで「PO が承認した内容」と「いまの文書」の一致が機械の網に入る。)
const PHASE_DOCS = {
  requirements: "requirements.md",
  design: "design.md",
  tasks: "tasks.md",
};

function sha256OfFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function checkApprovalIntegrity() {
  const NAME = "9. 承認の完全性（承認後に文書が変わっていないこと）";
  const dir = join(ROOT, ".kiro", "specs");
  if (!existsSync(dir)) {
    record(NAME, "skip", ".kiro/specs/ がまだありません");
    return;
  }
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  let checked = 0;
  let unhashed = 0;
  const bad = [];
  for (const name of names) {
    const specFile = join(dir, name, "spec.json");
    if (!existsSync(specFile)) continue;
    let spec;
    try {
      spec = JSON.parse(readFileSync(specFile, "utf8"));
    } catch {
      continue; // チェック4 の担当
    }
    const ap = spec?.approvals;
    if (!ap || typeof ap !== "object") continue;
    for (const [phase, doc] of Object.entries(PHASE_DOCS)) {
      const a = ap[phase];
      if (!a || a.approved !== true) continue;
      if (typeof a.approved_sha256 !== "string") {
        unhashed++;
        continue;
      }
      const docPath = join(dir, name, doc);
      if (!existsSync(docPath)) {
        bad.push(`${name}/${doc}: 承認済みなのに文書がありません`);
        continue;
      }
      checked++;
      if (sha256OfFile(docPath) !== a.approved_sha256) {
        bad.push(
          `${name}/${doc}: 承認後に内容が変わっています（${phase} の approved_sha256 と不一致）`,
        );
      }
    }
  }
  if (bad.length > 0) {
    record(
      NAME,
      "fail",
      bad.join("\n") +
        "\nPO が承認した内容と現在の文書が食い違っています。変更を戻すか、変更後の文書を /kiro-approve で再承認してください。",
    );
    return;
  }
  if (checked === 0 && unhashed === 0) {
    record(NAME, "skip", "承認済みの段がまだありません");
    return;
  }
  record(
    NAME,
    "pass",
    `ハッシュ付き承認 ${checked} 件すべて一致` +
      (unhashed > 0 ? `（ハッシュの無い旧形式の承認 ${unhashed} 件は対象外）` : ""),
  );
}

// ---- 10. 点検の鮮度 ----
// (定期棚卸し・rules GC・steering 点検・モデル世代適合点検は full-sdlc.md に定義されて
//  いるが、定義から自律的に発火した実績はゼロだった（2026-08-24 の監査。棚卸しは
//  131 コミット中実質3回、すべて人が起こした一回性のイベント。モデル世代適合点検は
//  定義から一度も未実行）。「トリガーは書いてあるが誰も発火させない」が最大の穴なので、
//  最終実施日を .claude/maintenance.json に記録し、頻繁に走る verify に催促させる。
//  fail ではなく warn——点検の実施自体は人間と統括の判断であり、機械が強制するのは
//  「忘れている事実の可視化」まで。)
const MAINTENANCE_JSON = join(ROOT, ".claude", "maintenance.json");
const MAINTENANCE_MAX_DAYS = 90;

function checkMaintenanceFreshness() {
  const NAME = "10. 点検の鮮度（定期棚卸しが放置されていないこと）";
  if (!existsSync(MAINTENANCE_JSON)) {
    record(
      NAME,
      "warn",
      ".claude/maintenance.json がありません。点検の最終実施日を記録する台帳です（full-sdlc.md の定常運用を参照）。",
    );
    return;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(MAINTENANCE_JSON, "utf8"));
  } catch (e) {
    record(NAME, "fail", `.claude/maintenance.json を読めません: ${e.message}`);
    return;
  }
  const inspections = data?.inspections;
  if (!inspections || typeof inspections !== "object") {
    record(NAME, "fail", ".claude/maintenance.json に inspections がありません");
    return;
  }
  const now = Date.now();
  const overdue = [];
  let count = 0;
  for (const [key, ins] of Object.entries(inspections)) {
    count++;
    const t = Date.parse(ins?.last);
    if (Number.isNaN(t)) {
      overdue.push(`${key}: last が日付として読めません（${ins?.last}）`);
      continue;
    }
    const days = Math.floor((now - t) / 86400000);
    if (days > MAINTENANCE_MAX_DAYS) {
      overdue.push(
        `${ins.label || key}: 最終実施 ${ins.last}（${days} 日前）`,
      );
    }
  }
  if (overdue.length > 0) {
    record(
      NAME,
      "warn",
      overdue.join("\n") +
        `\n${MAINTENANCE_MAX_DAYS} 日を超えています。full-sdlc.md の定常運用の該当箇条を実施し、.claude/maintenance.json の last を更新してください。`,
    );
    return;
  }
  record(NAME, "pass", `${count} 種の点検すべてが ${MAINTENANCE_MAX_DAYS} 日以内に実施済み`);
}

function main() {
  console.log("=== テンプレート整合性検証ハーネス（scripts/verify.mjs） ===\n");

  checkDocReferencesExist();
  checkGitignoreTwinConsistency();
  checkStatusReportFresh();
  checkSpecJsonReadable();
  checkVersionConsistency();
  checkHooksEnabled();
  checkContextBudget();
  checkDelegationGuards();
  checkApprovalIntegrity();
  checkMaintenanceFreshness();

  console.log("=== 結果一覧 ===");
  for (const r of results) {
    const icon =
      r.status === "pass"
        ? "✅"
        : r.status === "fail"
          ? "❌"
          : r.status === "warn"
            ? "⚠"
            : "⏭";
    console.log(`${icon} ${r.name}`);
  }

  if (results.some((r) => r.status === "fail")) {
    console.log("\n❌ 失敗したチェックがあります（詳細は上記ログ参照）。");
    process.exit(1);
  }
  console.log(
    "\n✅ すべてのチェックに合格しました（⚠/⏭ があれば個別に確認してください）。",
  );
  process.exit(0);
}

main();
