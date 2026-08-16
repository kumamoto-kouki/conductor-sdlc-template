#!/usr/bin/env node
// dashboard/ ビルド生成物の一括検証ハーネス。
//   使い方: node scripts/verify-dashboard.mjs   （または npm run verify）
//
// なぜ必要か: .claude/rules/dashboard-verification.md に定めた検証基準
// （① 正式閲覧はサーバー経由（npm run preview）・file://はコア表示のフォールバック
// ② 見た目の変更は実描画で受理（http＝正式閲覧相当／file://＝フォールバック確認の2段）
// ③「情報量を減らさない」は機械カウントで証明 ④ 失敗ビルド後の残留も検証対象）を、
// 毎回手作業で確認していると抜け漏れる。このスクリプトは同基準を1コマンドで機械化し、
// CI・pre-commit・手動確認のいずれからも同じ判定基準で回せるようにする。個々の
// チェックの「なぜ」は同ファイルを参照（各チェックの見出しコメントにも該当箇所を記す）。
//
// v0.4.0 で dashboard/ のビルド生成物を Git 管理外にした（.gitignore 参照）ため、
// 「ビルド結果が git 管理下の生成物とbit一致するか」を確認していた「コミット整合」
// チェックは前提が失われ撤去した（生成物はもう git 管理下にないので、そもそも
// 比較対象が存在しない）。
//
// 依存パッケージなし（node標準のみ、既存スクリプトの作法を踏襲）。
// 1つの失敗で止めず、すべてのチェックを実行してから合否をまとめて報告する
// （個々の失敗の因果関係を1回のログで把握できるようにするため）。
// ✅=合格 ❌=失敗（exit 1の原因） ⚠=要確認だが失敗扱いにしない ⏭=環境要因でスキップ。

import { execSync, spawn, spawnSync } from "node:child_process";
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
import { dirname, join, relative, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DASHBOARD_DIR = join(ROOT, "dashboard");
const STATUS_JSON = join(DASHBOARD_DIR, "status.json");
const HTML_PATH = join(DASHBOARD_DIR, "status-dashboard.html");
const ROLE_CATALOG_MD = join(ROOT, ".kiro", "steering", "role-catalog.md");
const PERSONAS_JSON = join(ROOT, "src", "data", "personas.json");

// ポータル化（Wave3 #3）で dashboard/reports/**・dashboard/steering/** の
// ネストしたページが増えたため、レンダースモーク・NaN漏れチェックは
// status-dashboard.html 決め打ちから「dashboard/ 配下の全 *.html」へ一般化する。
function findAllHtmlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

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
  // 説明文コメント）と <script>...</script> の本文を先に除去してから正規表現で
  // 判定する。除去しないと、コメントやスクリプト内の説明文・文字列リテラルに
  // 含まれる文字列を実要素と誤検出する（status-dashboard.html 末尾の Mermaid
  // 読み込み説明コメントで実際に起きた。file:// フォールバック用スクリプトの
  // コード中に例示として書いた `<pre class="mermaid">…コード…</pre>` という
  // 文字列が、未処理のMermaid要素として誤検出された実績もある）。
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
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

// ---- 2. 実描画スモーク（2段構え） ----
// (dashboard-verification.md: 「正式閲覧はサーバー経由（npm run preview）。file://は
//  コア表示のフォールバック」「実描画検証は2段構え。①http検証（正式閲覧相当）
//  ②file://検証（フォールバック確認）」)
//
// 2a. http検証: astro preview を子プロセスで起動し、実際のURLを headless chromium で
//     開いてMermaidの実描画（正式閲覧での見え方）を確認する。
// 2b. file://検証: file:// で開いた際に CSS が適用されていること、および
//     Mermaidモジュールが実行できない環境向けのプレースホルダーが生コードの露出を
//     防いでいることを確認する（Mermaid実描画自体は要求しない）。
//
// 構文チェック（mermaid.parse() 等）やDOM存在確認だけでは「表示されるが壊れている」を
// 2回すり抜けた実績があるため、どちらも実際にブラウザで開いて確認する。
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

// astro preview の起動完了（"Local  http://localhost:PORT/" のログ行）を待つ。
// 既定ポートが使用中の場合 astro 自身が別ポートへ自動フォールバックするため、
// 実際に採番されたURLをログから読み取る（固定ポートを仮定しない）。
function waitForPreviewReady(proc, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          `astro preview の起動待ちがタイムアウトしました\n出力:\n${buf}`,
        ),
      );
    }, timeoutMs);
    function onData(chunk) {
      buf += chunk.toString();
      const m = buf.match(/Local\s+(http:\/\/\S+)/);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(m[1]);
      }
    }
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    proc.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `astro preview が早期終了しました（exit ${code}）\n出力:\n${buf}`,
        ),
      );
    });
  });
}

// 1ページ分の実描画チェック（http・dump-dom結果から判定）。
// ポータル化（Wave3 #3）で dashboard/reports/**・dashboard/steering/** の
// 複数ページに対象が広がったため、status-dashboard.html 専用だった判定ロジックを
// 「任意の1ページ分の dom 文字列 + そのページの built html」から結果を返す形に
// 切り出し、全ページに同じ基準を適用できるようにした。
function evaluateRenderSmokeDom(dom, builtHtml, label) {
  const strippedDom = stripComments(dom);
  const svgCount = (strippedDom.match(/<svg[\s>]/g) || []).length;
  const processedCount = (strippedDom.match(/data-processed="true"/g) || [])
    .length;
  const unprocessed =
    strippedDom.match(
      /<pre class="mermaid[^"]*"(?![^>]*data-processed)[^>]*>/g,
    ) || [];

  // 期待図数はビルド済みHTML内の <pre class="mermaid"> 実数から動的に導出する
  // （独立レビュー指摘: 固定値のハードコードは図の増減で「図の総数以上」の意味から
  // 乖離する）。HTMLコメントとscriptブロックは除外する: フォールバック用スクリプトの
  // JSコメントと HTML内の説明コメントに同じ文字列が書かれており、素朴なカウントだと
  // 過剰計上する。除去順序が重要: コメント→scriptの順で除去する。逆順だと、コメント
  // 本文中の "<script>" という文字列にscript除去regexが食いつき、コメントの閉じ
  // (-->)ごと後続の実</script>まで誤って消費し、コメント前半が残骸として残る
  // （実測で発生）。
  const strippedBuilt = builtHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "");
  const expected = (strippedBuilt.match(/<pre class="mermaid/g) || []).length;

  // 空描画検知（独立レビューが実証した盲点）: MermaidのID衝突
  // （deterministicIds無効時、Date.now()由来のidが同一ミリ秒で衝突し、
  // data-processed="true"かつ<svg>は存在するのに中身が空になる）では、
  // svg数・processed数のカウントだけでは全条件を素通りする。
  // 各mermaid svgセグメントに実描画要素（path/text/rect等）が含まれるかまで検査する。
  const mermaidSvgSegments =
    strippedDom.match(/<svg[^>]*id="mermaid-[\s\S]*?<\/svg>/g) || [];
  const emptySvgs = mermaidSvgSegments.filter(
    (seg) => !/<(path|text|rect|polygon|circle|line|tspan)[\s>]/.test(seg),
  );

  const problems = [];
  if (svgCount < expected)
    problems.push(`Mermaid <svg> 数が不足: ${svgCount}（期待 >= ${expected}）`);
  if (processedCount < expected)
    problems.push(
      `data-processed="true" 数が不足: ${processedCount}（期待 >= ${expected}）`,
    );
  if (unprocessed.length > 0)
    problems.push(
      `未処理の <pre class="mermaid"> が残留: ${unprocessed.length}件`,
    );
  if (emptySvgs.length > 0)
    problems.push(
      `中身が空のMermaid svg: ${emptySvgs.length}件（processed=trueでも実描画要素なし＝ID衝突等の空描画）`,
    );

  return {
    label,
    ok: problems.length === 0,
    summary: `svg=${svgCount} data-processed=${processedCount}/${expected}`,
    problems,
  };
}

async function checkRenderSmokeHttp(chromiumBin) {
  const NAME =
    "2a. 実描画スモーク（http・astro preview経由・全生成ページ対象）";
  const htmlFiles = existsSync(DASHBOARD_DIR)
    ? findAllHtmlFiles(DASHBOARD_DIR)
    : [];
  if (htmlFiles.length === 0) {
    record(
      NAME,
      "fail",
      `${DASHBOARD_DIR} に *.html がありません（ビルドが先に失敗している可能性）`,
    );
    return;
  }

  const astroBin = join(ROOT, "node_modules", ".bin", "astro");
  let proc;
  try {
    proc = spawn(astroBin, ["preview"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const baseUrl = await waitForPreviewReady(proc, 15000);

    const perPage = [];
    for (const htmlFile of htmlFiles) {
      const rel = relative(DASHBOARD_DIR, htmlFile).split(sep).join("/");
      const targetUrl = new URL(rel, baseUrl).toString();
      const run = spawnSync(
        chromiumBin,
        [
          "--headless",
          "--disable-gpu",
          "--no-sandbox",
          "--virtual-time-budget=8000",
          "--dump-dom",
          targetUrl,
        ],
        { encoding: "utf8", timeout: 30000 },
      );
      if (run.error || run.status !== 0) {
        perPage.push({
          label: rel,
          ok: false,
          summary: "",
          problems: [
            `chromium の実行が失敗しました（exit ${run.status}）\n${run.stderr || run.error?.message || ""}`,
          ],
        });
        continue;
      }
      const builtHtml = readFileSync(htmlFile, "utf8");
      perPage.push(
        evaluateRenderSmokeDom(
          run.stdout || "",
          builtHtml,
          `${rel} (${targetUrl})`,
        ),
      );
    }

    const failed = perPage.filter((p) => !p.ok);
    const summaryLines = perPage.map(
      (p) =>
        `  ${p.ok ? "OK" : "NG"} ${p.label}${p.summary ? ` ${p.summary}` : ""}`,
    );
    if (failed.length === 0) {
      record(
        NAME,
        "pass",
        `${perPage.length} ページ全て合格\n${summaryLines.join("\n")}`,
      );
    } else {
      const problemLines = failed.flatMap((p) => [
        `  [${p.label}]`,
        ...p.problems.map((m) => `    ${m}`),
      ]);
      record(
        NAME,
        "fail",
        `${summaryLines.join("\n")}\n不合格詳細:\n${problemLines.join("\n")}`,
      );
    }
  } catch (e) {
    record(NAME, "fail", `検証中に例外: ${e.message}`);
  } finally {
    // astro preview は確実に終了させる（残留プロセスがポートを専有し続けるのを防ぐ）。
    if (proc && proc.exitCode === null && proc.signalCode === null) {
      proc.kill("SIGTERM");
    }
  }
}

// file:// でCSSが適用されているかは --dump-dom（生マークアップ）だけでは分からない
// ため、検証用コピーにだけ計測スクリプトを注入し、getComputedStyle の結果を
// data属性へ書き出させる（本番HTMLは書き換えない。依存パッケージなしの方針を
// 保つため画像のピクセル比較ではなくDOM計測で代替する）。
const CSS_PROBE_SCRIPT = `
<script>
  window.addEventListener("load", function () {
    setTimeout(function () {
      var accent = getComputedStyle(document.documentElement)
        .getPropertyValue("--c-accent")
        .trim();
      var bodyBg = getComputedStyle(document.body).backgroundColor;
      document.documentElement.setAttribute(
        "data-css-check",
        accent + "|" + bodyBg,
      );
    }, 500);
  });
</script>`;

// 1ページ分の file:// フォールバック判定（dom文字列から結果を返す）。
// ポータル化（Wave3 #3）で複数ページに対象が広がったため
// checkRenderSmokeHttp と同様に判定ロジックを切り出した。
function evaluateFileFallbackDom(dom, label) {
  const problems = [];

  const cssMatch = dom.match(/data-css-check="([^"]*)"/);
  if (!cssMatch || !cssMatch[1].split("|")[0]) {
    problems.push(
      "--c-accent トークンが解決できません（file://でCSSが適用されていない可能性）",
    );
  }

  const stripped = stripComments(dom);
  const mermaidTags =
    stripped.match(
      /<pre class="[^"]*\bmermaid\b[^"]*"[^>]*>[\s\S]*?<\/pre>/g,
    ) || [];
  const fallbackTags = mermaidTags.filter((tag) =>
    /mermaid-fallback/.test(tag),
  );
  const rawExposed = mermaidTags.filter(
    (tag) => !/mermaid-fallback/.test(tag) && /flowchart/.test(tag),
  );

  // mermaid図を持たないページ（reports/**等）では mermaidTags.length === 0 が
  // 正常系なので、そのページに図が無いこと自体はエラーにしない
  // （expected と同様、そのページの built html 側にコードフェンスが無いのが前提）。
  if (mermaidTags.length > 0 && fallbackTags.length === 0) {
    problems.push(
      "mermaid-fallback プレースホルダーが1件も適用されていません" +
        "（file://でMermaidモジュールが実行された、または検知ロジックが機能していない可能性）",
    );
  }
  if (rawExposed.length > 0) {
    problems.push(
      `生のMermaidコードがプレースホルダーに置き換わらず露出しています: ${rawExposed.length}件`,
    );
  }

  return {
    label,
    ok: problems.length === 0,
    summary: `css=${cssMatch ? cssMatch[1].split("|")[0] : "?"} fallback=${fallbackTags.length}/${mermaidTags.length}`,
    problems,
  };
}

function checkRenderSmokeFileFallback(chromiumBin) {
  const NAME =
    "2b. file://フォールバック（CSS適用＋Mermaidプレースホルダー表示・全生成ページ対象）";
  const htmlFiles = existsSync(DASHBOARD_DIR)
    ? findAllHtmlFiles(DASHBOARD_DIR)
    : [];
  if (htmlFiles.length === 0) {
    record(NAME, "fail", `${DASHBOARD_DIR} に *.html がありません`);
    return;
  }

  // snap版chromium等はホーム外のパス（/tmp直下等）を読めない場合があるため、
  // $HOME配下の一時ディレクトリへコピーしてから file:// で開く
  // （.claude/rules/dashboard-verification.md の運用メモに準拠）。
  let tmpDir;
  try {
    tmpDir = mkdtempSync(join(homedir(), ".verify-dashboard-file-fallback-"));
    const copiedDashboard = join(tmpDir, "dashboard");
    cpSync(DASHBOARD_DIR, copiedDashboard, { recursive: true });

    const perPage = [];
    for (const originalHtml of htmlFiles) {
      const rel = relative(DASHBOARD_DIR, originalHtml);
      const targetHtml = join(copiedDashboard, rel);

      let html = readFileSync(targetHtml, "utf8");
      html = html.replace("</body>", `${CSS_PROBE_SCRIPT}\n</body>`);
      writeFileSync(targetHtml, html);

      const run = spawnSync(
        chromiumBin,
        [
          "--headless",
          "--disable-gpu",
          "--no-sandbox",
          "--virtual-time-budget=3000",
          "--dump-dom",
          `file://${targetHtml}`,
        ],
        { encoding: "utf8", timeout: 30000 },
      );

      if (run.error || run.status !== 0) {
        perPage.push({
          label: rel,
          ok: false,
          summary: "",
          problems: [
            `chromium の実行が失敗しました（exit ${run.status}）\n${run.stderr || run.error?.message || ""}`,
          ],
        });
        continue;
      }
      perPage.push(evaluateFileFallbackDom(run.stdout || "", rel));
    }

    const failed = perPage.filter((p) => !p.ok);
    const summaryLines = perPage.map(
      (p) =>
        `  ${p.ok ? "OK" : "NG"} ${p.label}${p.summary ? ` ${p.summary}` : ""}`,
    );
    if (failed.length === 0) {
      record(
        NAME,
        "pass",
        `${perPage.length} ページ全て合格\n${summaryLines.join("\n")}`,
      );
    } else {
      const problemLines = failed.flatMap((p) => [
        `  [${p.label}]`,
        ...p.problems.map((m) => `    ${m}`),
      ]);
      record(
        NAME,
        "fail",
        `${summaryLines.join("\n")}\n不合格詳細:\n${problemLines.join("\n")}`,
      );
    }
  } catch (e) {
    record(NAME, "fail", `検証中に例外: ${e.message}`);
  } finally {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function checkRenderSmoke() {
  const chromiumBin = findChromium();
  if (!chromiumBin) {
    const detail =
      "chromium/chromium-browser/google-chrome のいずれも見つかりません。" +
      "この環境ではスキップします（既存のprettierベストエフォート方針と同じfail-soft）。";
    record(
      "2a. 実描画スモーク（http・astro preview経由・全生成ページ対象）",
      "skip",
      detail,
    );
    record(
      "2b. file://フォールバック（CSS適用＋Mermaidプレースホルダー表示・全生成ページ対象）",
      "skip",
      detail,
    );
    return;
  }
  await checkRenderSmokeHttp(chromiumBin);
  checkRenderSmokeFileFallback(chromiumBin);
}

// ---- 3. 要素数レポート: h2/h3/tr/li/badge等の出現数をHEADコミット版と比較 ----
// (dashboard-verification.md: 「『情報量を減らさない』は機械カウントで証明する」。
//  差分自体はエラーにしない＝意図的な変更もあるため。情報が減る方向の差だけ⚠で警告する)
function checkElementCountReport() {
  const NAME = "3. 要素数レポート（HEAD比較・全生成ページ対象・減少方向のみ⚠）";
  const htmlFiles = existsSync(DASHBOARD_DIR)
    ? findAllHtmlFiles(DASHBOARD_DIR)
    : [];
  if (htmlFiles.length === 0) {
    record(NAME, "fail", `${DASHBOARD_DIR} に *.html がありません`);
    return;
  }

  let decreasedAny = false;
  const blocks = [];
  for (const htmlFile of htmlFiles) {
    const rel = relative(DASHBOARD_DIR, htmlFile).split(sep).join("/");
    const current = countElements(readFileSync(htmlFile, "utf8"));

    let headHtml;
    try {
      headHtml = execSync(`git show HEAD:dashboard/${rel}`, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // ポータル化（Wave3 #3）で新規追加されたページは HEAD に存在しないため
      // 比較のしようがない。情報量が「減った」わけではないので fail/warn には
      // しない。今回の現在値だけを参考情報として記録する（次回コミット以降は
      // HEAD 比較が効くようになる）。
      const rows = Object.keys(current)
        .map((k) => `${k}=${current[k]}`)
        .join(" ");
      blocks.push(`  [${rel}] (HEAD未存在・新規ページ) ${rows}`);
      continue;
    }
    const head = countElements(headHtml);

    const rows = Object.keys(current);
    const lines = [`  [${rel}]`, "    要素      HEAD    現在    差分"];
    let fileDecreased = false;
    for (const key of rows) {
      const diff = current[key] - head[key];
      if (diff < 0) fileDecreased = true;
      const sign = diff > 0 ? `+${diff}` : `${diff}`;
      lines.push(
        `    ${key.padEnd(8)}  ${String(head[key]).padStart(6)}  ${String(current[key]).padStart(6)}  ${sign}`,
      );
    }
    if (fileDecreased) decreasedAny = true;
    blocks.push(lines.join("\n"));
  }

  const detail = blocks.join("\n");
  if (decreasedAny) {
    record(
      NAME,
      "warn",
      `情報が減る方向の差分があります（意図的な変更なら問題ありません。要確認）:\n${detail}`,
    );
  } else {
    record(NAME, "pass", detail);
  }
}

// ---- 4. 失敗ビルド残留: 必須フィールド欠落でビルド失敗させ、内部アーティファクトが
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
    "4. 失敗ビルド残留（壊れたstatus.jsonでのビルド失敗→内部アーティファクト非残留→復元）";
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

// ---- 5. NaN/undefined漏れ: 生成HTMLに \bNaN\b|\bundefined\b が出現しないこと ----
// (schema.mjs: zod検証は「範囲外の値をNaNの静かな漏出でなく明確なエラーで止める」ためだが、
//  検証を通過した正常データ経路でも算出ロジックの誤りでNaN/undefinedが漏れうるため、
//  生成物側でも独立に確認する)
function checkNoNaNOrUndefined() {
  const NAME = "5. NaN/undefined漏れ（生成HTML全ページへの静かな漏出防止）";
  const htmlFiles = existsSync(DASHBOARD_DIR)
    ? findAllHtmlFiles(DASHBOARD_DIR)
    : [];
  if (htmlFiles.length === 0) {
    record(NAME, "fail", `${DASHBOARD_DIR} に *.html がありません`);
    return;
  }
  const offenders = [];
  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, "utf8");
    const matches = html.match(/\bNaN\b|\bundefined\b/g) || [];
    if (matches.length > 0) {
      offenders.push(
        `  ${relative(DASHBOARD_DIR, htmlFile)}: ${matches.length}件（${matches.slice(0, 5).join(", ")}${matches.length > 5 ? " ..." : ""}）`,
      );
    }
  }
  if (offenders.length === 0) {
    record(
      NAME,
      "pass",
      `${htmlFiles.length} ページで NaN/undefined の出現なし`,
    );
  } else {
    record(NAME, "fail", offenders.join("\n"));
  }
}

// ---- 6. role-catalog.md ⇔ personas.json 役割整合（Markdown表とJSONの双子drift検知） ----
// (`.kiro/steering/role-catalog.md` の「配役表（現状）」表と「候補ロスター」表が役割一覧の
//  正本で、`src/data/personas.json` はそれをダッシュボード描画用に転記した別フォーマットの
//  双子。Markdown表とJSONは本質的にフォーマットが異なり「参照（リンク）」だけでは二重化を
//  防げないため、`.claude/rules/steering-consistency.md` の方針どおり機械的な突き合わせで
//  検知する。片方だけに存在する役割名があれば失敗として報告する)
function extractMarkdownTableSection(content, headingText) {
  const idx = content.indexOf(headingText);
  if (idx === -1) return null;
  const rest = content.slice(idx + headingText.length);
  const nextHeadingMatch = rest.match(/\n##\s/);
  const end = nextHeadingMatch ? nextHeadingMatch.index : rest.length;
  return rest.slice(0, end);
}

function extractPersonaNamesFromMarkdownTable(section) {
  const names = [];
  const lines = section.split("\n").filter((l) => l.trim().startsWith("|"));
  for (const line of lines) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length === 0) continue;
    const first = cells[0];
    if (/^-+$/.test(first.replace(/:/g, ""))) continue; // 区切り行（|---|---|）
    if (first === "ペルソナ" || first === "候補") continue; // ヘッダー行
    // セルは「絵文字 役割名」形式（例: "🧑🏼‍💼 統括"）。絵文字はスペースを含まないため
    // 最初の空白で分割すれば役割名だけが残る。
    const spaceIdx = first.indexOf(" ");
    if (spaceIdx === -1) continue;
    const name = first.slice(spaceIdx + 1).trim();
    if (name) names.push(name);
  }
  return names;
}

function checkRoleCatalogPersonaConsistency() {
  const NAME =
    "6. role-catalog.md ⇔ personas.json 役割整合（配役表＋候補ロスター）";
  if (!existsSync(ROLE_CATALOG_MD) || !existsSync(PERSONAS_JSON)) {
    record(
      NAME,
      "fail",
      `role-catalog.md または personas.json が見つかりません（${ROLE_CATALOG_MD} / ${PERSONAS_JSON}）`,
    );
    return;
  }
  const roleCatalogContent = readFileSync(ROLE_CATALOG_MD, "utf8");
  const assignedSection = extractMarkdownTableSection(
    roleCatalogContent,
    "## 配役表（現状）",
  );
  const candidateSection = extractMarkdownTableSection(
    roleCatalogContent,
    "## 候補ロスター",
  );
  if (!assignedSection || !candidateSection) {
    record(
      NAME,
      "fail",
      "role-catalog.md から「配役表（現状）」または「候補ロスター」の節を抽出できませんでした（見出し文言が変わった可能性）",
    );
    return;
  }
  const catalogNames = new Set([
    ...extractPersonaNamesFromMarkdownTable(assignedSection),
    ...extractPersonaNamesFromMarkdownTable(candidateSection),
  ]);
  if (catalogNames.size === 0) {
    record(
      NAME,
      "fail",
      "role-catalog.md の配役表・候補ロスターから役割名を1件も抽出できませんでした（表フォーマットが変わった可能性）",
    );
    return;
  }

  let personas;
  try {
    personas = JSON.parse(readFileSync(PERSONAS_JSON, "utf8"));
  } catch (e) {
    record(NAME, "fail", `personas.json の parse に失敗しました: ${e.message}`);
    return;
  }
  const personaNames = new Set(personas.map((p) => p.name));

  const onlyInCatalog = [...catalogNames]
    .filter((n) => !personaNames.has(n))
    .sort();
  const onlyInPersonas = [...personaNames]
    .filter((n) => !catalogNames.has(n))
    .sort();

  if (onlyInCatalog.length === 0 && onlyInPersonas.length === 0) {
    record(
      NAME,
      "pass",
      `${catalogNames.size} 件の役割名が role-catalog.md と personas.json で一致`,
    );
  } else {
    const detail = [
      onlyInCatalog.length > 0
        ? `role-catalog.md のみに存在（personas.json に反映漏れ）: ${onlyInCatalog.join(", ")}`
        : "",
      onlyInPersonas.length > 0
        ? `personas.json のみに存在（role-catalog.md に反映漏れ、または命名不一致）: ${onlyInPersonas.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    record(NAME, "fail", detail);
  }
}

// ---- 7. modelUsage[].role ⇔ personas.json 役割整合 ----
// (dashboard/status.json の modelUsage は「規定でなく実績」の記録
// （.claude/playbooks/model-assignment.md 参照）。role は表記ゆれなく
// src/data/personas.json の name と一致している必要があり、これが崩れると
// 存在しない役割名がダッシュボードにそのまま表示されてしまう。modelUsage は
// 後方互換のため status.json に無くてもよい任意キー（schema.mjs で optional）
// なので、その場合はスキップにする。)
function checkModelUsageRoleConsistency() {
  const NAME = "7. modelUsage[].role ⇔ personas.json 役割整合";
  let data;
  try {
    data = JSON.parse(readFileSync(STATUS_JSON, "utf8"));
  } catch (e) {
    record(NAME, "fail", `status.json の parse に失敗しました: ${e.message}`);
    return;
  }
  if (!data.modelUsage) {
    record(NAME, "skip", "status.json に modelUsage が無いためスキップ");
    return;
  }
  if (!existsSync(PERSONAS_JSON)) {
    record(NAME, "fail", `personas.json が見つかりません（${PERSONAS_JSON}）`);
    return;
  }
  let personas;
  try {
    personas = JSON.parse(readFileSync(PERSONAS_JSON, "utf8"));
  } catch (e) {
    record(NAME, "fail", `personas.json の parse に失敗しました: ${e.message}`);
    return;
  }
  const personaNames = new Set(personas.map((p) => p.name));
  const entries = data.modelUsage.entries || [];
  const unknown = entries
    .map((e, i) => ({ i, role: e.role }))
    .filter((e) => !personaNames.has(e.role));

  if (unknown.length === 0) {
    record(
      NAME,
      "pass",
      `${entries.length} 件の modelUsage エントリの role がすべて personas.json に存在`,
    );
  } else {
    const detail = unknown
      .map(
        (e) =>
          `modelUsage.entries[${e.i}].role: "${e.role}" は personas.json に存在しません`,
      )
      .join("\n");
    record(NAME, "fail", detail);
  }
}

// ---- 8. AI向けドキュメントのリポジトリ相対参照の実在検証 ----
// (棚卸し（.claude/playbooks/full-sdlc.md「### 1. 定期健全性チェック」）で
//  ドキュメントを移動・削除すると、他の文書に残った相対参照だけがリンク切れになる。
//  これを機械で検知する。対象は CLAUDE.md・.claude/ 配下・.kiro/steering/ 配下の
//  Markdown（AI が読む文書の全体）。抽出はバッククォートで囲まれ、かつ
//  .claude/.kiro/scripts/src/dashboard/bin のいずれかで始まる「リポジトリ相対と
//  明確に分かる」参照だけに絞る。裸のファイル名参照（例: "orchestration.md" が
//  .kiro/steering/orchestration.md を指す）やスキル相対参照（例:
//  "rules/design-principles.md"）、spec生成物（design.md・tasks.md・spec.json 等）
//  まで対象にすると誤検知が大量に出て、チェックが無視されるようになるため対象外。
//  プレースホルダ・テンプレ記法（<...>・*・{...}・$...・（...）を含むもの）も除外する。
const DOC_REF_TARGET_PATTERN = /^(CLAUDE\.md|\.claude\/|\.kiro\/steering\/)/;
const DOC_REF_PATTERN =
  /`((?:\.claude|\.kiro|scripts|src|dashboard|bin)\/[^`\s]+\.(?:md|mjs|json|sh|astro|mdx))`/g;
const DOC_REF_PLACEHOLDER_CHARS = /[<>*{}$（）]/;
// 許可リスト（実在しなくてよい参照）: .kiro/steering/roadmap.md は
// /kiro-discovery が複数spec構成のプロジェクトで生成する成果物であり、
// テンプレート状態のリポジトリには存在しないのが正常なため除外する。
const DOC_REF_ALLOWLIST = new Set([".kiro/steering/roadmap.md"]);

function checkDocReferencesExist() {
  const NAME = "8. AI向けドキュメントのリポジトリ相対参照の実在検証";
  const files = execSync("git ls-files '*.md'", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => DOC_REF_TARGET_PATTERN.test(f));

  let total = 0;
  const missing = [];
  for (const f of files) {
    const content = readFileSync(join(ROOT, f), "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const re = new RegExp(DOC_REF_PATTERN);
      let m;
      while ((m = re.exec(lines[i]))) {
        const ref = m[1];
        if (DOC_REF_PLACEHOLDER_CHARS.test(ref)) continue;
        total++;
        if (DOC_REF_ALLOWLIST.has(ref)) continue;
        if (!existsSync(join(ROOT, ref))) {
          missing.push(`${f}:${i + 1} -> ${ref}`);
        }
      }
    }
  }

  if (missing.length === 0) {
    record(
      NAME,
      "pass",
      `${files.length} ファイル走査・明確な相対参照 ${total} 件のうち実在しないもの0件（許可リスト適用後）`,
    );
  } else {
    record(NAME, "fail", missing.join("\n"));
  }
}

async function main() {
  console.log(
    "=== dashboard 検証ハーネス（scripts/verify-dashboard.mjs） ===\n",
  );

  checkDeterminism();
  await checkRenderSmoke();
  checkElementCountReport();
  checkFailedBuildResidue();
  checkNoNaNOrUndefined();
  checkRoleCatalogPersonaConsistency();
  checkModelUsageRoleConsistency();
  checkDocReferencesExist();

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
}

main();
