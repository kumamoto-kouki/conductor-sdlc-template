#!/usr/bin/env node
// docs/status-dashboard.html を docs/status.json + scripts/templates/dashboard-template.html
// からビルド時に完全な静的HTMLとして生成する。
//
// 設計方針（.kiro/steering/operations.md 参照）:
// - status.json が唯一の真実。ダッシュボードHTMLは手編集しない。
// - 節目(milestones)が単一の真実。見積もりKPI・見積もり内訳表・節目カードの bar は
//   すべて difficulty/estimateH/progress から算出する（二重入力しない）。
// - スナップショット日付は持たない。changelog[0].date がヘッダーの日付として使われる。
// - 画面側/Rust テストの合計 KPI は specs[].screenTests/rustTests + sharedTests の合計から算出する。
//
// 使い方: node scripts/generate-dashboard.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STATUS_JSON_PATH = join(ROOT, "docs", "status.json");
const TEMPLATE_PATH = join(
  ROOT,
  "scripts",
  "templates",
  "dashboard-template.html",
);
const OUTPUT_PATH = join(ROOT, "docs", "status-dashboard.html");

const GENERATED_NOTICE = `<!--
  ⚠ 自動生成ファイル。手編集しないこと。
  状態を更新する場合は docs/status.json を編集し、
  node scripts/generate-dashboard.mjs を再実行して、このファイルを再生成すること。
  テンプレート（静的な骨格）は scripts/templates/dashboard-template.html。
-->`;

// dashboard-template.html にだけ必要な「テンプレート部品なので直接開かない」注記は
// 生成物には不要（生成物には GENERATED_NOTICE が入るため）。存在すれば取り除く。
const TEMPLATE_ONLY_COMMENT_RE =
  /\n?\s*<!--\n\s*これはテンプレート部品です[\s\S]*?-->\n?/;

// ---- ヘルパー -------------------------------------------------------------

const TONE_CLASS = {
  ok: "badge-ok",
  warn: "badge-warn",
  bad: "badge-bad",
  mute: "badge-mute",
  info: "badge-info",
  upd: "badge-upd",
};
const LANE_COLOR = { design: "#b08968", eng: "#6a8caf" };

// 検証状態モデル（evidence）: 受理の裏付け種別。badge text はここから自動生成し、
// 手書きで個別管理しない（二重管理の再発防止・.kiro/steering/operations.md 参照）。
const EVIDENCE_LABELS = {
  "auto-test": "自動テスト",
  "manual-visual": "実機目視",
  "live-api": "実API疎通",
  "po-signoff": "PO判断",
};
const PROOF_KINDS = ["auto-test", "manual-visual", "live-api"];

function evidenceLabel(evidence) {
  if (!evidence || evidence.length === 0) return "—";
  return evidence.map((e) => EVIDENCE_LABELS[e] || e).join(" / ");
}

// evidence に po-signoff のみが含まれ、他の実証系（auto-test/manual-visual/live-api）
// が一切無い場合は「実証が無いままPOがサインオフした」ことが分かるよう badge に
// 「（実機未）」を自動付記する。badge.text を個別に手書きしない設計にするための集約点。
function badgeTextWithEvidenceSuffix(text, evidence) {
  if (!evidence || evidence.length === 0) return text;
  const hasProof = evidence.some((e) => PROOF_KINDS.includes(e));
  const hasSignoffOnly = evidence.includes("po-signoff") && !hasProof;
  return hasSignoffOnly ? `${text}（実機未）` : text;
}

function badge(b, evidence) {
  if (!b) return "";
  const text = badgeTextWithEvidenceSuffix(b.text, evidence);
  return `<span class="badge ${TONE_CLASS[b.tone] || "badge-mute"}">${text}</span>`;
}

function pct(n) {
  return Math.round(n * 100);
}

function visibleMilestones(data) {
  return data.milestones.filter((m) => !m.hideCard);
}

// テンプレート内の `id="targetId"` を含む開始タグを見つけ、対応する終了タグまでの
// 中身を innerHtml に置き換える（DOM の innerHTML 代入に相当する文字列操作）。
// 対象コンテナはすべて中身を持たない空要素（<tag ... id="x" ...></tag>）のため、
// タグ名の入れ子を追跡して対応する閉じタグを探す。
function setInnerHtml(html, targetId, innerHtml) {
  const idAttr = `id="${targetId}"`;
  const idIndex = html.indexOf(idAttr);
  if (idIndex === -1) {
    throw new Error(`テンプレートに id="${targetId}" が見つかりません`);
  }

  // idAttr を含む開始タグの `<tagname` を後方に探す
  const tagOpenIndex = html.lastIndexOf("<", idIndex);
  const tagNameMatch = /^<([a-zA-Z0-9]+)/.exec(html.slice(tagOpenIndex));
  if (!tagNameMatch) {
    throw new Error(`id="${targetId}" の開始タグ名を特定できません`);
  }
  const tagName = tagNameMatch[1];

  // 開始タグ自身の `>` を探す（属性値に > が来ない前提。本テンプレートでは該当なし）
  const openTagEnd = html.indexOf(">", idIndex);
  if (openTagEnd === -1) {
    throw new Error(`id="${targetId}" の開始タグの終端 '>' が見つかりません`);
  }
  const contentStart = openTagEnd + 1;

  // 同名タグの入れ子を追跡して対応する閉じタグを探す
  const openRe = new RegExp(`<${tagName}(?=[\\s>])`, "g");
  const closeRe = new RegExp(`</${tagName}>`, "g");
  openRe.lastIndex = contentStart;
  closeRe.lastIndex = contentStart;

  let depth = 1;
  let searchFrom = contentStart;
  let closeTagStart = -1;
  while (depth > 0) {
    openRe.lastIndex = searchFrom;
    closeRe.lastIndex = searchFrom;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) {
      throw new Error(
        `id="${targetId}" (<${tagName}>) の閉じタグが見つかりません`,
      );
    }
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      searchFrom = nextOpen.index + 1;
    } else {
      depth -= 1;
      closeTagStart = nextClose.index;
      searchFrom = nextClose.index + 1;
    }
  }

  return html.slice(0, contentStart) + innerHtml + html.slice(closeTagStart);
}

function setTextContent(html, targetId, text) {
  return setInnerHtml(html, targetId, escapeHtmlText(text));
}

function escapeHtmlText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---- 各セクションのレンダラー（インラインscriptからのロジック移植） --------

function renderEstimate(data) {
  const rows = data.milestones.map((m) => {
    const done = m.estimateH * m.progress;
    const remain = m.estimateH * (1 - m.progress);
    const label = m.id === "cross" ? m.label : `${m.id} ${m.label}`;
    return `
      <tr>
        <td>${label}</td>
        <td>${m.difficulty}/5</td>
        <td>${m.estimateH}h</td>
        <td>${pct(m.progress)}%</td>
        <td>${done.toFixed(1)}h</td>
        <td>${remain.toFixed(1)}h</td>
      </tr>`;
  });
  const totalEstimate = data.milestones.reduce((s, m) => s + m.estimateH, 0);
  const totalDone = data.milestones.reduce(
    (s, m) => s + m.estimateH * m.progress,
    0,
  );
  const totalRemain = totalEstimate - totalDone;
  const overallPct = pct(totalDone / totalEstimate);

  return `
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <div class="kpi !text-3xl text-accent">~${totalEstimate}h</div>
        <div class="tag">全体の見積</div>
      </div>
      <div>
        <div class="kpi !text-3xl text-info">~${totalDone.toFixed(1)}h</div>
        <div class="tag">これまで（換算）</div>
      </div>
      <div>
        <div class="kpi !text-3xl text-warn">~${totalRemain.toFixed(1)}h</div>
        <div class="tag">残り（概算）</div>
      </div>
      <div>
        <div class="kpi !text-3xl text-ok">${overallPct}%</div>
        <div class="tag">全体の進捗</div>
      </div>
    </div>
    <div class="bar mt-3"><span style="width: ${overallPct}%"></span></div>
    <details class="mt-3">
      <summary class="cursor-pointer text-xs font-semibold text-muted">
        内訳（マイルストーン別の見積・進捗・残り）
      </summary>
      <table class="mt-2">
        <tr>
          <th>区分</th><th>難易度</th><th>見積</th><th>進捗</th><th>これまで</th><th>残り</th>
        </tr>
        ${rows.join("")}
        <tr>
          <td><b>合計</b></td>
          <td>—</td>
          <td><b>${totalEstimate}h</b></td>
          <td><b>${overallPct}%</b></td>
          <td><b>${totalDone.toFixed(1)}h</b></td>
          <td><b>${totalRemain.toFixed(1)}h</b></td>
        </tr>
      </table>
      <div class="mt-2 text-[11px] text-muted">
        計算式: 見積(h)=タスク数×難易度(1–5)×ボリューム係数 を丸めた概算。
        これまで=見積×進捗%、残り=見積×(1−進捗%)。
        全体の進捗% = Σ(見積×進捗) / Σ見積（上のKPI・この表・節目カードの bar はすべて同じ値から算出）。
        ※ AIエージェント実測とは別の「人間換算の参考値」です。
      </div>
    </details>`;
}

function renderMilestoneCards(data) {
  return visibleMilestones(data)
    .map((m) => {
      const notes = [m.note, m.remainingNote].filter(Boolean);
      const tag = notes.length
        ? `<div class="tag">${notes.join("　残り: ")}</div>`
        : "";
      return `
        <div class="card">
          <h3>${m.title} ${badge(m.badge, m.evidence)}</h3>
          <div class="bar"><span style="width: ${pct(m.progress)}%"></span></div>
          ${tag}
        </div>`;
    })
    .join("");
}

function testsLabel(spec) {
  const parts = [];
  if (spec.rustTests != null) parts.push(`Rust ${spec.rustTests}`);
  if (spec.screenTests != null) {
    let s = `画面側 ${spec.screenTests}`;
    if (spec.screenTestsNote) s += `（${spec.screenTestsNote}）`;
    parts.push(s);
  }
  return parts.join(" / ");
}

function renderSpecs(data) {
  return data.specs
    .map(
      (s) => `
      <tr>
        <td>${s.name}</td>
        <td>${s.stage}</td>
        <td>${s.impl}</td>
        <td>${testsLabel(s)}</td>
        <td>${evidenceLabel(s.evidence)}</td>
        <td>${badge(s.badge, s.evidence)}</td>
      </tr>`,
    )
    .join("");
}

function renderKpi(data) {
  const rustTotal =
    data.specs.reduce((s, x) => s + (x.rustTests || 0), 0) +
    data.sharedTests.rust;
  const screenTotal =
    data.specs.reduce((s, x) => s + (x.screenTests || 0), 0) +
    data.sharedTests.screen;
  const cards = [
    {
      value: rustTotal,
      label: "Rust テスト 合格",
      tone: "accent",
      note: `裏側（Rust）の自動テスト。機能別 ${rustTotal - data.sharedTests.rust} ＋ ${data.sharedTests.note}分 ${data.sharedTests.rust}。`,
    },
    {
      value: screenTotal,
      label: "画面側テスト 合格",
      tone: "info",
      note: `画面側（TypeScript）の自動テスト。機能別 ${screenTotal - data.sharedTests.screen} ＋ ${data.sharedTests.note}分 ${data.sharedTests.screen}。`,
    },
    ...data.kpiExtra,
  ];
  return cards
    .map(
      (k) => `
      <div class="card">
        <div class="kpi text-${k.tone}">${k.value} <small>${k.label}</small></div>
        <div class="tag">${k.note}</div>
      </div>`,
    )
    .join("");
}

function boardCard(item, size) {
  const color = LANE_COLOR[item.lane] || LANE_COLOR.eng;
  const idBox =
    size === "sm"
      ? `<span class="grid h-5 w-6 flex-none place-items-center rounded text-[10px] font-bold text-white" style="background: ${color}">${item.id}</span>`
      : `<span class="grid h-6 w-7 flex-none place-items-center rounded-md text-[${item.id.length > 3 ? "10" : "11"}px] font-bold text-white" style="background: ${color}">${item.id}</span>`;
  const titleSpan =
    size === "sm"
      ? `<span class="min-w-0 flex-1 text-[11px] font-semibold">${item.title}</span>`
      : `<span class="min-w-0 flex-1 text-[11.5px] font-semibold">${item.title}</span>`;
  const trailing = item.note
    ? `<span class="flex-none rounded bg-[#f4efe7] px-1.5 text-[10px] font-bold text-muted">${item.note}</span>`
    : item.actors
      ? `<span class="text-[${size === "sm" ? "10" : "11"}px]" title="${item.actorsTip || ""}">${item.actors}</span>`
      : "";
  return `
    <div class="flex items-center gap-${size === "sm" ? "1.5" : "2"} rounded-lg bg-card p-1.5 ring-1 ring-line/60" title="${item.tip}">
      ${idBox}
      ${titleSpan}
      ${trailing}
    </div>`;
}

function boardColumn(title, style, items, size, footnote) {
  const body = items.length
    ? `<div class="space-y-1.5 p-2">${items.map((i) => boardCard(i, size)).join("")}${footnote ? `<div class="px-1 pt-0.5 text-[10px] text-muted">${footnote}</div>` : ""}</div>`
    : `<div class="p-2 text-center text-[11px] text-muted">—</div>`;
  return `
    <div class="overflow-hidden rounded-xl ring-1 ring-line/70">
      <div class="px-3 py-1.5 text-xs font-bold" style="${style}">${title}</div>
      ${body}
    </div>`;
}

function renderBoard(data) {
  const lanes = data.board.lanes;
  return `
    <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      ${boardColumn("⏳ 待ち", "background: #ece7df; color: #6f675f", lanes.waiting, "sm")}
      ${boardColumn(
        "🔨 進行中",
        "background: #fbf3e0; color: #7a5b12",
        lanes.inProgress,
        "sm",
        lanes.inProgress[0] && lanes.inProgress[0].footnote,
      )}
      ${boardColumn("🔍 レビュー中", "background: #e9f0f7; color: #2c5680", lanes.review, "sm")}
      ${boardColumn("✅ 完了・受理", "background: #e4f0ea; color: #2e7d52", lanes.done, "md")}
    </div>
    <div class="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      <div class="rounded-lg bg-[#f4efe7] px-3 py-2">
        <b>次の候補</b>：${data.board.nextCandidates}
      </div>
      <div class="rounded-lg bg-[#f4efe7] px-3 py-2 text-muted">
        <b>繰越</b>：${data.board.carryover}
      </div>
    </div>`;
}

function renderOperations(data) {
  const op = data.operations;
  return `
    <div class="mb-3 text-xs text-muted">${op.intro}</div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div><div class="kpi !text-3xl text-accent">${op.delegated}</div><div class="tag">委譲（実装）</div></div>
      <div><div class="kpi !text-3xl text-ok">${op.accepted}</div><div class="tag">受理（＋直対応 R1）</div></div>
      <div><div class="kpi !text-3xl text-warn">${op.discarded}</div><div class="tag">破棄（古ベース）</div></div>
      <div><div class="kpi !text-3xl text-info">${op.reviews}</div><div class="tag">独立レビュー</div></div>
    </div>
    <div class="mt-4 text-sm font-bold">事故 → 是正（仕組みの修正）</div>
    <table class="mt-2">
      <tr><th>事故（仕組みの弱さ）</th><th>是正</th><th>効力</th></tr>
      ${op.incidents.map((i) => `<tr><td>${i.issue}</td><td>${i.fix}</td><td>${i.effect}</td></tr>`).join("")}
    </table>
    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span><b>レビュー判定</b>：${op.verdictsSummary}</span>
    </div>
    <div class="mt-4 text-sm font-bold">
      開示の健全性（心理的安全性）
      <span class="note">— 感情でなく機構で観測（運用）</span>
    </div>
    <div class="mb-2 text-[11px] text-muted">${op.disclosureIntro}</div>
    <table class="mt-1">
      <tr><th>兆候（機構で測る）</th><th>現状</th></tr>
      ${op.signals.map((s) => `<tr><td>${s.signal}</td><td>${s.status}</td></tr>`).join("")}
    </table>
    <div class="mt-1.5 text-[11px] text-muted">${op.disciplineNote}</div>
    <div class="mt-3 rounded-lg bg-[#f4efe7] px-3 py-2 text-xs text-muted">${op.consultNote}</div>
    <div class="mt-2 text-[11px] text-muted">${op.registryNote}</div>`;
}

function renderNextActions(data) {
  const na = data.nextActions;
  return `
    <div class="card">
      <h3>優先 <span class="badge badge-bad">高</span></h3>
      <ul class="tight">${na.high.map((i) => `<li>${i}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3>見守り <span class="badge badge-warn">中</span></h3>
      <ul class="tight">${na.watch.map((i) => `<li>${i}</li>`).join("")}</ul>
    </div>`;
}

function renderChangelog(data) {
  const [current, ...history] = data.changelog;
  const historyItems = history.flatMap((entry) => entry.items);
  return `
    <h2>🔵 この版の更新（${current.date}）</h2>
    <ul class="list-disc pl-[18px] text-[13px] [&>li]:my-0.5">
      ${current.items.map((i) => `<li>${i}</li>`).join("")}
    </ul>
    ${
      historyItems.length
        ? `<details class="mt-2">
            <summary class="cursor-pointer text-xs font-semibold text-muted">これまでの更新履歴（クリックで展開）</summary>
            <ul class="mt-2 list-disc pl-[18px] text-[13px] [&>li]:my-0.5">
              ${historyItems.map((i) => `<li>${i}</li>`).join("")}
            </ul>
          </details>`
        : ""
    }
    <div class="mt-2.5 text-xs text-muted">
      以降、ダッシュボードを更新するたびに、ここに日付つきで「何が変わったか」を残します（古い版との差分がわかるように）。
    </div>`;
}

// ---- メイン ----------------------------------------------------------------

function main() {
  const data = JSON.parse(readFileSync(STATUS_JSON_PATH, "utf8"));
  let html = readFileSync(TEMPLATE_PATH, "utf8");
  html = html.replace(TEMPLATE_ONLY_COMMENT_RE, "\n");

  html = setTextContent(html, "hdr-snapshot", data.changelog[0].date);
  html = setTextContent(html, "hdr-branch", data.branch);
  html = setTextContent(html, "board-updated-badge", data.board.updatedLabel);
  html = setInnerHtml(html, "board-headline", data.board.headline);
  html = setInnerHtml(html, "estimate-root", renderEstimate(data));
  html = setInnerHtml(html, "board-root", renderBoard(data));
  html = setInnerHtml(html, "milestones-root", renderMilestoneCards(data));
  html = setInnerHtml(html, "specs-root", renderSpecs(data));
  html = setInnerHtml(html, "kpi-root", renderKpi(data));
  html = setInnerHtml(html, "operations-root", renderOperations(data));
  html = setInnerHtml(html, "next-actions-root", renderNextActions(data));
  html = setInnerHtml(html, "changelog-root", renderChangelog(data));

  // 自動生成の警告コメントを <title> の直後に挿入
  html = html.replace(
    /(<title>[^<]*<\/title>\n)/,
    `$1    ${GENERATED_NOTICE}\n`,
  );

  // HTML生成（本質的な責務）はここまでで完了・成功している。
  // これ以降の prettier 整形は後処理（あれば見た目を整える／無くても生成の成功は損なわれない）。
  writeFileSync(OUTPUT_PATH, html);
  console.log(`generated: ${OUTPUT_PATH}`);

  formatWithPrettierBestEffort();
}

// prettier 整形はベストエフォート。`npx` はPATH解決に任せる（環境固有の絶対パスを
// ハードコードしない＝テンプレートとして他プロジェクトへコピーされる前提のため）。
// prettier が無い/失敗する環境でも、HTML生成自体の成功はブロックしない
// （警告を出して exit 0 で終える。生成済みHTMLは未整形のまま残る）。
function formatWithPrettierBestEffort() {
  try {
    execFileSync(
      "npx",
      ["--yes", "prettier", "--write", "docs/status-dashboard.html"],
      {
        cwd: ROOT,
        stdio: "inherit",
      },
    );
    console.log("prettier: formatted docs/status-dashboard.html");
  } catch (err) {
    console.warn(
      `⚠ prettier 整形をスキップしました（HTML生成自体は成功済み）: ${err.message}`,
    );
  }
}

main();
