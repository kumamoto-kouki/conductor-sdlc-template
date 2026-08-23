#!/usr/bin/env node
/**
 * STATUS.md を生成する。
 *
 * 設計の要点（なぜこの作りか）:
 *  - 内容はすべてリポジトリの実データから「導出」する。手で書く欄を持たない。
 *    かつて dashboard/status.json は手書きが正本だったため、テンプレート本体でも
 *    生成プロジェクトでも実態とずれたまま誰も気づかなかった。導出にすれば「書き忘れ」
 *    による陳腐化は起きない。ただし導出元そのものが壊れている場合は別問題であり、
 *    読めなかった入力は沈黙させず STATUS.md 本文に出す（黙って落とすと、撤去理由に
 *    挙げたのと同じ「実在する spec が表示されない」状態を再現してしまう）。
 *  - 出力にタイムスタンプや git log を含めない。同じリポジトリ状態からは常に同じ
 *    バイト列が出るため、「再生成して差分が出るか」で最新かどうかを機械判定できる。
 *    「いつの情報か」は STATUS.md を最後に更新したコミットが答える。
 *  - 依存パッケージを持たない。node だけで動くので npm install 前でも実行できる。
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPECS_DIR = path.join(ROOT, ".kiro", "specs");
const ROLE_CATALOG = path.join(ROOT, ".kiro", "steering", "role-catalog.md");
const OUT = path.join(ROOT, "STATUS.md");

/** 承認の3段から「いまどの工程か」と「次に誰が何をするか」を決める。
 *  phase フィールドではなく approvals を根拠にする理由: approvals は3段すべての
 *  生成・承認を独立に持つため、phase 文字列の表記ゆれや書き漏れに影響されない。 */
const STAGES = [
  {
    key: "requirements",
    label: "要件",
    generate: (f) => `/kiro-spec-requirements ${f}`,
  },
  { key: "design", label: "設計", generate: (f) => `/kiro-spec-design ${f}` },
  { key: "tasks", label: "タスク", generate: (f) => `/kiro-spec-tasks ${f}` },
];

function readJson(file) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (e) {
    return { ok: false, reason: e.code === "ENOENT" ? "spec.json がありません" : "spec.json を JSON として読めません" };
  }
}

function approvalMark(a) {
  if (!a) return "—";
  if (a.approved) return "承認済";
  if (a.generated) return "確認待ち";
  return "—";
}

/** 仕様1件の現在地。戻り値の owner は「次に動くのが誰か」。
 *  owner が null なら終端（次にやることが無い）。 */
function progressOf(spec, tasks) {
  const f = spec.feature_name;
  const ap = spec.approvals || {};
  for (const st of STAGES) {
    const a = ap[st.key] || {};
    if (!a.generated) {
      return {
        stage: `${st.label}づくり`,
        owner: "dev",
        next: `${st.generate(f)} を実行する`,
      };
    }
    if (!a.approved) {
      return {
        stage: `${st.label}の確認`,
        owner: "po",
        next: `${st.label}を読んで承認する（${path.posix.join(".kiro/specs", f, st.key + ".md")}）`,
      };
    }
  }
  // タスクを数え切れていて全件done なら終端。ここを持たないと、出し終えた機能が
  // 永久に「実装」「/kiro-impl を実行する」と表示され続ける。
  if (tasks && tasks.total > 0 && tasks.done === tasks.total) {
    return { stage: "完了", owner: null, next: null };
  }
  return { stage: "実装", owner: "dev", next: `/kiro-impl ${f} を実行する` };
}

/** tasks.md のチェックボックスを数える。
 *  - `[x]` と `[X]` の両方を完了として扱う（片方だけ見ると分母からも落ちる）。
 *  - ``` フェンス内の行は数えない（設計例やコード片に含まれるチェックボックスを
 *    実タスクとして数えてしまうため）。
 *  - 子タスク（`N.M`）が1つでもあれば子タスクだけを数える。テンプレートは親
 *    （`- [ ] 1.`）と子（`- [ ] 1.1`）の両方をチェックボックスにするため、
 *    両方数えると分母が実作業単位より膨らむ（実測: 親7＋子31＝38 に対し実作業は31）。 */
function taskProgress(featureDir) {
  const file = path.join(featureDir, "tasks.md");
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const parents = [];
  const children = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^\s*- \[([ xX])\]\s*(\d+)(\.\d+)?/.exec(line);
    if (!m) continue;
    const done = m[1] !== " ";
    (m[3] ? children : parents).push(done);
  }
  const items = children.length > 0 ? children : parents;
  if (items.length === 0) return null;
  return { done: items.filter(Boolean).length, total: items.length };
}

/** tasks.md の `_Model: xxx_` を集計する。実際にどのモデルを割り当てる計画かを示す。 */
function modelPlan(featureDir) {
  const file = path.join(featureDir, "tasks.md");
  if (!fs.existsSync(file)) return {};
  const counts = {};
  const re = /_Model:\s*([A-Za-z0-9.\-]+)_/g;
  const text = fs.readFileSync(file, "utf8");
  let m;
  while ((m = re.exec(text)) !== null) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  return counts;
}

/** role-catalog.md の配役表を読む。ここが配役の正本であり、この関数は転記しない。 */
function readCast() {
  if (!fs.existsSync(ROLE_CATALOG)) {
    return { rows: [], problem: `${path.relative(ROOT, ROLE_CATALOG)} がありません` };
  }
  const text = fs.readFileSync(ROLE_CATALOG, "utf8");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^## 配役表/.test(l));
  if (start === -1) {
    return {
      rows: [],
      problem: "role-catalog.md に「## 配役表」で始まる節が見つかりません（節名を変えると配役を読めなくなります）",
    };
  }
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{2,3} /.test(line)) break;
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    if (/^-+$/.test(cells[0].replace(/\s/g, ""))) continue;
    if (cells[0] === "ペルソナ") continue;
    rows.push({ persona: cells[0], role: cells[1], state: cells[3] });
  }
  if (rows.length === 0) {
    return {
      rows: [],
      problem: "「## 配役表」節に4列以上の表の行が見つかりません（列構成が変わった可能性があります）",
    };
  }
  return { rows, problem: null };
}

function progressBar(done, total) {
  const width = 10;
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function listSpecs() {
  if (!fs.existsSync(SPECS_DIR)) return { specs: [], unreadable: [] };
  const specs = [];
  const unreadable = [];
  const dirs = fs
    .readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en"));
  for (const name of dirs) {
    const dir = path.join(SPECS_DIR, name);
    const r = readJson(path.join(dir, "spec.json"));
    if (!r.ok) {
      // 黙って落とさない。撤去した status.json は「実在する spec を 0 件と表示」
      // したまま誰も気づかなかった。読めなかった入力は本文に出す。
      unreadable.push({ name, reason: r.reason });
      continue;
    }
    const spec = r.value;
    if (!spec.feature_name) spec.feature_name = name;
    specs.push({ dir, spec });
  }
  specs.sort((a, b) =>
    a.spec.feature_name.localeCompare(b.spec.feature_name, "en"),
  );
  return { specs, unreadable };
}

/** 表のセルに入れる文字列。`|` は表を壊すのでエスケープする。 */
function cell(text) {
  return String(text).replace(/\|/g, "\\|");
}

function build() {
  const out = [];
  const { specs, unreadable } = listSpecs();
  const progress = new Map();
  for (const { dir, spec } of specs) {
    const tasks = taskProgress(dir);
    progress.set(spec.feature_name, { tasks, p: progressOf(spec, tasks) });
  }

  out.push("# プロジェクト状況");
  out.push("");
  out.push("<!--");
  out.push("  このファイルは `npm run status` が生成します。手で編集しないでください。");
  out.push("  内容はすべてリポジトリの実データから導出しています:");
  out.push("    .kiro/specs/*/spec.json      … どの工程まで進み、どこまで承認されたか");
  out.push("    .kiro/specs/*/tasks.md       … タスクの消化数と割り当てモデル");
  out.push("    .kiro/steering/role-catalog.md … 参画する役");
  out.push("  「いつの情報か」は、このファイルを最後に更新したコミットが答えます。");
  out.push("-->");
  out.push("");

  // --- 読み取れなかった入力（あれば最初に出す） ---
  if (unreadable.length > 0) {
    out.push("## ⚠ 読み取れなかった仕様");
    out.push("");
    out.push(
      "次のディレクトリは `.kiro/specs/` にありますが、状況を読み取れませんでした。**下の表には現れていません。**",
    );
    out.push("");
    for (const u of unreadable) {
      out.push(`- \`${cell(u.name)}\` — ${u.reason}`);
    }
    out.push("");
  }

  // --- 仕様の進み具合 ---
  out.push("## 仕様の進み具合");
  out.push("");
  if (specs.length === 0) {
    out.push('まだ仕様がありません。`/kiro-discovery "やりたいこと"` から始めてください。');
    out.push("");
  } else {
    out.push("| 仕様 | いまの工程 | 要件 | 設計 | タスク | 実装 |");
    out.push("| --- | --- | --- | --- | --- | --- |");
    for (const { spec } of specs) {
      const { tasks, p } = progress.get(spec.feature_name);
      const ap = spec.approvals || {};
      const impl = tasks
        ? `${progressBar(tasks.done, tasks.total)} ${tasks.done}/${tasks.total}`
        : "—";
      out.push(
        `| \`${cell(spec.feature_name)}\` | ${p.stage} | ${approvalMark(ap.requirements)} | ${approvalMark(ap.design)} | ${approvalMark(ap.tasks)} | ${impl} |`,
      );
    }
    out.push("");
  }

  // --- 次にやること ---
  out.push("## 次にやること");
  out.push("");
  const poItems = [];
  const devItems = [];
  for (const { spec } of specs) {
    const { p } = progress.get(spec.feature_name);
    if (!p.owner) continue; // 終端（完了）は「次にやること」に載せない
    (p.owner === "po" ? poItems : devItems).push(
      `- \`${cell(spec.feature_name)}\` — ${p.next}`,
    );
  }
  out.push("**あなた（PO）の番**");
  out.push("");
  out.push(...(poItems.length === 0 ? ["- いま承認を待っているものはありません。"] : poItems));
  out.push("");
  out.push("**開発の番**");
  out.push("");
  out.push(...(devItems.length === 0 ? ["- 進行中の作業はありません。"] : devItems));
  out.push("");

  // --- 参画する役 ---
  const { rows: cast, problem: castProblem } = readCast();
  out.push("## 参画する役");
  out.push("");
  if (castProblem) {
    out.push(`⚠ 配役を読み取れませんでした: ${castProblem}`);
    out.push("");
  } else {
    const active = cast.filter((r) => /^常時|^配役済/.test(r.state));
    const idle = cast.filter((r) => !/^常時|^配役済/.test(r.state));
    out.push("| ペルソナ | 役割 | 状態 |");
    out.push("| --- | --- | --- |");
    for (const r of active) {
      out.push(`| ${cell(r.persona)} | ${cell(r.role)} | ${cell(r.state)} |`);
    }
    out.push("");
    if (idle.length > 0) {
      out.push("座っていない席:");
      out.push("");
      for (const r of idle) {
        out.push(`- ${cell(r.persona)}（${cell(r.state)}） — ${cell(r.role)}`);
      }
      out.push("");
    }
  }
  out.push(
    "正本は [`.kiro/steering/role-catalog.md`](.kiro/steering/role-catalog.md) です。",
  );
  out.push("");

  // --- モデルの割り当て ---
  const models = {};
  for (const { dir } of specs) {
    for (const [k, v] of Object.entries(modelPlan(dir))) {
      models[k] = (models[k] || 0) + v;
    }
  }
  const modelKeys = Object.keys(models).sort();
  if (modelKeys.length > 0) {
    out.push("## タスクに指定されたモデル");
    out.push("");
    out.push("| モデル | タスク数 |");
    out.push("| --- | --- |");
    for (const k of modelKeys) out.push(`| ${cell(k)} | ${models[k]} |`);
    out.push("");
    out.push(
      "指定の無いタスクは実装者の既定モデルで動きます。判断基準は [`.claude/playbooks/model-assignment.md`](.claude/playbooks/model-assignment.md) を参照してください。",
    );
    out.push("");
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const content = build();
const check = process.argv.includes("--check");

if (check) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
  if (current === content) {
    console.log("STATUS.md は最新です。");
    process.exit(0);
  }
  console.error("STATUS.md がリポジトリの実態と一致していません。");
  console.error("`npm run status` を実行して再生成してください。");
  process.exit(1);
}

fs.writeFileSync(OUT, content, "utf8");
const summary = listSpecs();
console.log(
  `STATUS.md を生成しました（仕様 ${summary.specs.length} 件` +
    (summary.unreadable.length > 0
      ? `・読み取れなかったもの ${summary.unreadable.length} 件`
      : "") +
    "）。",
);
