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
  /^(CLAUDE\.md|README\.md|\.claude\/|\.kiro\/steering\/|docs\/)/;
const DOC_REF_PATTERN =
  /`((?:\.claude|\.kiro|scripts|docs|bin)\/[^`\s]+\.(?:md|mjs|json|sh))`/g;
const DOC_REF_PLACEHOLDER_CHARS = /[<>*{}$（）]/;
// 許可リスト（実在しなくてよい参照）: .kiro/steering/roadmap.md は
// /kiro-discovery が複数spec構成のプロジェクトで生成する成果物であり、
// テンプレート状態のリポジトリには存在しないのが正常なため除外する。
const DOC_REF_ALLOWLIST = new Set([".kiro/steering/roadmap.md"]);
// 生成プロジェクトでのみ実在しなくてよい参照。scripts/init-project.sh は npx 入口である
// bin/ を複製先へ配らない（生成プロジェクトはスキャフォルダではないため）。テンプレート
// 本体では実在を要求し、生成側でのみ許可する。無条件の許可リストに入れると、テンプレート
// 本体で bin/create.mjs を壊しても検知できなくなる。
const DOC_REF_SCAFFOLD_ONLY = new Set(["bin/create.mjs"]);

function checkDocReferencesExist() {
  const NAME = "1. AI向けドキュメントのリポジトリ相対参照の実在検証";
  const isTemplateBody = existsSync(PACKAGE_SCAFFOLD_JSON);
  const files = execSync("git ls-files '*.md'", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => DOC_REF_TARGET_PATTERN.test(f));

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
      const re = new RegExp(DOC_REF_PATTERN);
      let m;
      while ((m = re.exec(lines[i]))) {
        const ref = m[1];
        if (DOC_REF_PLACEHOLDER_CHARS.test(ref)) continue;
        total++;
        if (DOC_REF_ALLOWLIST.has(ref)) continue;
        if (!isTemplateBody && DOC_REF_SCAFFOLD_ONLY.has(ref)) continue;
        if (!existsSync(join(ROOT, ref))) {
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
  if (readFileSync(GITIGNORE, "utf8") === readFileSync(TEMPLATE_GITIGNORE, "utf8")) {
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
      if (!j || typeof j !== "object") throw new Error("オブジェクトではありません");
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

function main() {
  console.log("=== テンプレート整合性検証ハーネス（scripts/verify.mjs） ===\n");

  checkDocReferencesExist();
  checkGitignoreTwinConsistency();
  checkStatusReportFresh();
  checkSpecJsonReadable();

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
