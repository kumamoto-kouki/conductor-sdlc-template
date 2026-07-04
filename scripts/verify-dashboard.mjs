#!/usr/bin/env node
// dashboard/ ビルド生成物の一括検証ハーネス。
//   使い方: node scripts/verify-dashboard.mjs   （または npm run verify）
//
// なぜ必要か: .claude/rules/dashboard-verification.md に定めた検証基準
// （① file:// 直開きは不変条件 ② 見た目の変更は実描画で受理 ③「情報量を減らさない」は
// 機械カウントで証明 ④ 失敗ビルド後の残留も検証対象）を、毎回手作業で確認していると
// 抜け漏れる。このスクリプトは同基準を1コマンドで機械化し、CI・pre-commit・手動確認の
// いずれからも同じ判定基準で回せるようにする。個々のチェックの「なぜ」は同ファイルを
// 参照（各チェックの見出しコメントにも該当箇所を記す）。
//
// 依存パッケージなし（node標準のみ、既存スクリプトの作法を踏襲）。
// 1つの失敗で止めず、すべてのチェックを実行してから合否をまとめて報告する
// （個々の失敗の因果関係を1回のログで把握できるようにするため）。
// ✅=合格 ❌=失敗（exit 1の原因） ⚠=要確認だが失敗扱いにしない ⏭=環境要因でスキップ。

import { execSync, spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdtempSync,
  rmSync,
  cpSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DASHBOARD_DIR = join(ROOT, "dashboard");
const STATUS_JSON = join(DASHBOARD_DIR, "status.json");
const HTML_PATH = join(DASHBOARD_DIR, "status-dashboard.html");

const results = []; // { name, status: "pass" | "fail" | "warn" | "skip", detail }

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
}

function runBuild() {
  return spawnSync("npm", ["run", "build"], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function hashTree(dir) {
  const map = new Map();
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = relative(dir, full);
        map.set(
          rel,
          createHash("sha256").update(readFileSync(full)).digest("hex"),
        );
      }
    }
  }
  walk(dir);
  return map;
}

function diffHashTrees(a, b) {
  const diffs = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of [...keys].sort()) {
    if (a.get(k) !== b.get(k)) {
      diffs.push(
        `  ${k}: ${a.has(k) ? a.get(k).slice(0, 8) : "(なし)"} -> ${b.has(k) ? b.get(k).slice(0, 8) : "(なし)"}`,
      );
    }
  }
  return diffs;
}

function stripComments(html) {
  // HTMLコメント（例: <!-- ... <pre class="mermaid"> の描画のみ ... --> という
  // 説明文コメント）を先に除去してから正規表現で判定する。除去しないと、
  // コメント本文に含まれる説明文の中の文字列を実要素と誤検出する
  // （status-dashboard.html 末尾の Mermaid 読み込み説明コメントで実際に起きた）。
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function countElements(html) {
  const stripped = stripComments(html);
  return {
    h2: (stripped.match(/<h2[\s>]/g) || []).length,
    h3: (stripped.match(/<h3[\s>]/g) || []).length,
    tr: (stripped.match(/<tr[\s>]/g) || []).length,
    li: (stripped.match(/<li[\s>]/g) || []).length,
    badge: (stripped.match(/class="badge[^"]*"/g) || []).length,
  };
}

// ---- 1. 決定性: npm run build を2回実行し、dashboard/ 配下全ファイルのハッシュが一致 ----
// (.claude/rules/dashboard-verification.md: 生成過程の再現性そのものは明文化されていないが、
//  ②「実描画で受理」・③「機械カウント」が意味を持つ前提として、同じ入力から同じ出力が
//  出ることがまず要る)
function checkDeterminism() {
  const NAME = "1. 決定性（2回ビルドしたdashboard/のハッシュ一致）";
  const build1 = runBuild();
  if (build1.status !== 0) {
    record(
      NAME,
      "fail",
      `1回目の npm run build が失敗しました（exit ${build1.status}）\n${build1.stderr || build1.stdout}`,
    );
    return;
  }
  const hash1 = hashTree(DASHBOARD_DIR);
  const build2 = runBuild();
  if (build2.status !== 0) {
    record(
      NAME,
      "fail",
      `2回目の npm run build が失敗しました（exit ${build2.status}）\n${build2.stderr || build2.stdout}`,
    );
    return;
  }
  const hash2 = hashTree(DASHBOARD_DIR);
  const diffs = diffHashTrees(hash1, hash2);
  if (diffs.length === 0) {
    record(NAME, "pass", `${hash1.size} ファイルのハッシュが完全一致`);
  } else {
    record(NAME, "fail", `差異ファイル:\n${diffs.join("\n")}`);
  }
}

// ---- 2. コミット整合: ビルド結果が git 管理下の生成物とbit一致 ----
// (dashboard-verification.md の対象外だが、①file://直開き運用は「dashboard/がgit上の
//  実体そのもの」を前提にしており、status.json/テンプレ変更後の再ビルド漏れは
//  file://で開いたときに古い生成物を見せる事故に直結する)
function checkCommitIntegrity() {
  const NAME = "2. コミット整合（dashboard/ の未コミット差分なし）";
  let out;
  try {
    out = execSync("git status --porcelain -- dashboard/", {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch (e) {
    record(NAME, "fail", `git status の実行に失敗しました: ${e.message}`);
    return;
  }
  if (out.trim() === "") {
    record(NAME, "pass", "git status --porcelain dashboard/ は空");
  } else {
    record(
      NAME,
      "fail",
      "status.json やテンプレ（src/ 等）を変更したのに生成物（dashboard/ 配下）を" +
        "再コミットしていない可能性があります。`npm run build` を実行し、変更された" +
        `dashboard/ 配下を同じコミットに含めてください。\n差分:\n${out}`,
    );
  }
}

// ---- 3. 実描画スモーク: headless chromium で file:// を開きMermaidの実描画を確認 ----
// (dashboard-verification.md: 「見た目に関わる変更は実ブラウザ描画で受理する。構文チェックや
//  DOM存在確認は『表示されるが壊れている』を2回すり抜けた実績がある」)
function findChromium() {
  const candidates = [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ];
  for (const c of candidates) {
    const r = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (!r.error && r.status === 0) return c;
  }
  return null;
}

function checkRenderSmoke() {
  const NAME = "3. 実描画スモーク（headless chromiumでのMermaid描画確認）";
  const chromiumBin = findChromium();
  if (!chromiumBin) {
    record(
      NAME,
      "skip",
      "chromium/chromium-browser/google-chrome のいずれも見つかりません。" +
        "この環境ではスキップします（既存のprettierベストエフォート方針と同じfail-soft）。",
    );
    return;
  }
  if (!existsSync(HTML_PATH)) {
    record(
      NAME,
      "fail",
      `${HTML_PATH} が存在しません（ビルドが先に失敗している可能性）`,
    );
    return;
  }

  // snap版chromium等はホーム外のパス（/tmp直下等）を読めない場合があるため、
  // $HOME配下の一時ディレクトリへコピーしてから file:// で開く
  // （.claude/rules/dashboard-verification.md の運用メモに準拠）。
  let tmpDir;
  try {
    tmpDir = mkdtempSync(join(homedir(), ".verify-dashboard-smoke-"));
    cpSync(DASHBOARD_DIR, join(tmpDir, "dashboard"), { recursive: true });
    const targetHtml = join(tmpDir, "dashboard", "status-dashboard.html");

    const run = spawnSync(
      chromiumBin,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--virtual-time-budget=8000",
        "--dump-dom",
        `file://${targetHtml}`,
      ],
      { encoding: "utf8", timeout: 30000 },
    );

    if (run.error || run.status !== 0) {
      record(
        NAME,
        "fail",
        `chromium の実行が失敗しました（exit ${run.status}）\n${run.stderr || run.error?.message || ""}`,
      );
      return;
    }

    const dom = stripComments(run.stdout || "");
    const svgCount = (dom.match(/<svg[\s>]/g) || []).length;
    const processedCount = (dom.match(/data-processed="true"/g) || []).length;
    const unprocessed =
      dom.match(/<pre class="mermaid[^"]*"(?![^>]*data-processed)[^>]*>/g) ||
      [];

    const problems = [];
    if (svgCount < 8)
      problems.push(`Mermaid <svg> 数が不足: ${svgCount}（期待 >= 8）`);
    if (processedCount < 8)
      problems.push(
        `data-processed="true" 数が不足: ${processedCount}（期待 >= 8）`,
      );
    if (unprocessed.length > 0)
      problems.push(
        `未処理の <pre class="mermaid"> が残留: ${unprocessed.length}件`,
      );

    if (problems.length === 0) {
      record(
        NAME,
        "pass",
        `svg=${svgCount} data-processed=${processedCount} 未処理残留=0`,
      );
    } else {
      record(NAME, "fail", problems.join("\n"));
    }
  } catch (e) {
    record(NAME, "fail", `検証中に例外: ${e.message}`);
  } finally {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---- 4. 要素数レポート: h2/h3/tr/li/badge等の出現数をHEADコミット版と比較 ----
// (dashboard-verification.md: 「『情報量を減らさない』は機械カウントで証明する」。
//  差分自体はエラーにしない＝意図的な変更もあるため。情報が減る方向の差だけ⚠で警告する)
function checkElementCountReport() {
  const NAME = "4. 要素数レポート（HEAD比較・減少方向のみ⚠）";
  if (!existsSync(HTML_PATH)) {
    record(NAME, "fail", `${HTML_PATH} が存在しません`);
    return;
  }
  const current = countElements(readFileSync(HTML_PATH, "utf8"));

  let headHtml;
  try {
    headHtml = execSync("git show HEAD:dashboard/status-dashboard.html", {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch {
    record(
      NAME,
      "skip",
      "HEAD に dashboard/status-dashboard.html が存在しません（初回コミット前など）",
    );
    return;
  }
  const head = countElements(headHtml);

  const rows = Object.keys(current);
  const lines = [
    "  要素      HEAD    現在    差分",
    "  --------  ------  ------  ----",
  ];
  let decreased = false;
  for (const key of rows) {
    const diff = current[key] - head[key];
    if (diff < 0) decreased = true;
    const sign = diff > 0 ? `+${diff}` : `${diff}`;
    lines.push(
      `  ${key.padEnd(8)}  ${String(head[key]).padStart(6)}  ${String(current[key]).padStart(6)}  ${sign}`,
    );
  }
  const detail = lines.join("\n");
  if (decreased) {
    record(
      NAME,
      "warn",
      `情報が減る方向の差分があります（意図的な変更なら問題ありません。要確認）:\n${detail}`,
    );
  } else {
    record(NAME, "pass", detail);
  }
}

// ---- 5. 失敗ビルド残留: 必須フィールド欠落でビルド失敗させ、内部アーティファクトが
//         dashboard/ 直下に残留しないこと・復元後の再ビルドで元に戻ることを確認 ----
// (dashboard-verification.md: 「失敗ビルド後の状態も検証対象。emptyOutDir:false 運用の
//  ため、ビルド失敗時に内部アーティファクトが dashboard/ に残留しうる」)
const INTERNAL_ARTIFACT_PATTERNS = [
  /^\.prerender$/,
  /^manifest_.*\.mjs$/,
  /^chunks$/,
  /^pages$/,
  /^_noop-.*$/,
  /^noop-entrypoint\.mjs$/,
  /^renderers\.mjs$/,
];

function listInternalArtifacts() {
  return readdirSync(DASHBOARD_DIR).filter((entry) =>
    INTERNAL_ARTIFACT_PATTERNS.some((p) => p.test(entry)),
  );
}

function checkFailedBuildResidue() {
  const NAME =
    "5. 失敗ビルド残留（壊れたstatus.jsonでのビルド失敗→内部アーティファクト非残留→復元）";
  const original = readFileSync(STATUS_JSON, "utf8");
  try {
    const data = JSON.parse(original);
    const broken = { ...data };
    delete broken.milestones; // 必須フィールド（min(1)）を欠落させ、zod検証エラーでビルド失敗を誘発する
    writeFileSync(STATUS_JSON, JSON.stringify(broken, null, 2));

    const build = runBuild();
    const buildFailedAsExpected = build.status !== 0;
    const residue = listInternalArtifacts();

    writeFileSync(STATUS_JSON, original); // 先に復元してから合否を判定する

    if (!buildFailedAsExpected) {
      record(
        NAME,
        "fail",
        "status.json のmilestonesを欠落させてもビルドが失敗しませんでした" +
          "（zod検証が機能していない可能性）。",
      );
      return;
    }
    if (residue.length > 0) {
      record(
        NAME,
        "fail",
        `ビルド失敗時に内部アーティファクトが残留しました: ${residue.join(", ")}`,
      );
      return;
    }

    const rebuild = runBuild();
    if (rebuild.status !== 0) {
      record(
        NAME,
        "fail",
        `status.json復元後の再ビルドが失敗しました\n${rebuild.stderr || rebuild.stdout}`,
      );
      return;
    }

    record(
      NAME,
      "pass",
      `ビルド失敗を確認（exit ${build.status}）、内部アーティファクト残留なし、復元後の再ビルドは成功`,
    );
  } catch (e) {
    record(NAME, "fail", `検証中に例外: ${e.message}`);
  } finally {
    // 例外経路でも必ず元のstatus.jsonへ戻す
    writeFileSync(STATUS_JSON, original);
  }
}

// ---- 6. NaN/undefined漏れ: 生成HTMLに \bNaN\b|\bundefined\b が出現しないこと ----
// (schema.mjs: zod検証は「範囲外の値をNaNの静かな漏出でなく明確なエラーで止める」ためだが、
//  検証を通過した正常データ経路でも算出ロジックの誤りでNaN/undefinedが漏れうるため、
//  生成物側でも独立に確認する)
function checkNoNaNOrUndefined() {
  const NAME = "6. NaN/undefined漏れ（生成HTMLへの静かな漏出防止）";
  if (!existsSync(HTML_PATH)) {
    record(NAME, "fail", `${HTML_PATH} が存在しません`);
    return;
  }
  const html = readFileSync(HTML_PATH, "utf8");
  const matches = html.match(/\bNaN\b|\bundefined\b/g) || [];
  if (matches.length === 0) {
    record(NAME, "pass", "NaN/undefined の出現なし");
  } else {
    record(
      NAME,
      "fail",
      `${matches.length}件出現: ${matches.slice(0, 10).join(", ")}${matches.length > 10 ? " ..." : ""}`,
    );
  }
}

console.log("=== dashboard 検証ハーネス（scripts/verify-dashboard.mjs） ===\n");

checkDeterminism();
checkCommitIntegrity();
checkRenderSmoke();
checkElementCountReport();
checkNoNaNOrUndefined();
checkFailedBuildResidue();

console.log("\n=== 結果一覧 ===");
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

const hasFail = results.some((r) => r.status === "fail");
if (hasFail) {
  console.log("\n❌ 失敗したチェックがあります（詳細は上記ログ参照）。");
  process.exit(1);
} else {
  console.log(
    "\n✅ すべてのチェックに合格しました（⚠/⏭ があれば個別に確認してください）。",
  );
  process.exit(0);
}
