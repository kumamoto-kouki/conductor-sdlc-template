// status.json から派生値を計算する（旧 scripts/generate-dashboard.mjs のロジック移植）。
// 計算はここに集約する（コンポーネント側で再計算しない）。
// 全体進捗% = Σ(estimateH×progress) / Σ estimateH（節目カード・見積もり表・KPIで同一値を使う）。

export const TONE_CLASS = {
  ok: "badge-ok",
  warn: "badge-warn",
  bad: "badge-bad",
  mute: "badge-mute",
  info: "badge-info",
  upd: "badge-upd",
};

export const LANE_COLOR = {
  design: "var(--c-lane-design)",
  eng: "var(--c-lane-eng)",
};

// 検証状態モデル（evidence）: 受理の裏付け種別。badge text はここから自動生成し、
// 手書きで個別管理しない（二重管理の再発防止・.kiro/steering/operations.md 参照）。
export const EVIDENCE_LABELS = {
  "auto-test": "自動テスト",
  "manual-visual": "実機目視",
  "live-api": "実API疎通",
  "po-signoff": "PO判断",
};
const PROOF_KINDS = ["auto-test", "manual-visual", "live-api"];

export function evidenceLabel(evidence) {
  if (!evidence || evidence.length === 0) return "—";
  return evidence.map((e) => EVIDENCE_LABELS[e] || e).join(" / ");
}

// evidence に po-signoff のみが含まれ、他の実証系（auto-test/manual-visual/live-api）
// が一切無い場合は「実証が無いままPOがサインオフした」ことが分かるよう badge に
// 「（実機未）」を自動付記する。badge.text を個別に手書きしない設計にするための集約点。
export function badgeTextWithEvidenceSuffix(text, evidence) {
  if (!evidence || evidence.length === 0) return text;
  const hasProof = evidence.some((e) => PROOF_KINDS.includes(e));
  const hasSignoffOnly = evidence.includes("po-signoff") && !hasProof;
  return hasSignoffOnly ? `${text}（実機未）` : text;
}

export function pct(n) {
  return Math.round(n * 100);
}

// 更新箇所のピンポイント化（PO指示 v2 #7）: item.updatedAt（"YYYY-MM-DD"）から
// チップ表示用の短い日付ラベルを作る（年を落とし M/D のみにする＝装飾的な精度を
// 増やさない。writing-standards.md「後で参照しない固有名・数値は出さない」）。
export function updatedChipLabel(updatedAt) {
  if (!updatedAt) return null;
  const parts = updatedAt.split("-");
  if (parts.length !== 3) return `更新 ${updatedAt}`;
  const [, m, d] = parts;
  return `更新 ${Number(m)}/${Number(d)}`;
}

export function visibleMilestones(data) {
  return data.milestones.filter((m) => !m.hideCard);
}

export function testsLabel(spec) {
  const parts = [];
  if (spec.rustTests != null) parts.push(`Rust ${spec.rustTests}`);
  if (spec.screenTests != null) {
    let s = `画面側 ${spec.screenTests}`;
    if (spec.screenTestsNote) s += `（${spec.screenTestsNote}）`;
    parts.push(s);
  }
  return parts.join(" / ");
}

/**
 * 見積もり時間サマリー（KPI 4枚＋内訳表）を算出する。
 * これまで=見積×進捗、残り=見積×(1-進捗)、全体の進捗%はこれらの合計から算出。
 */
export function computeEstimate(data) {
  const rows = data.milestones.map((m) => {
    const done = m.estimateH * m.progress;
    const remain = m.estimateH * (1 - m.progress);
    const label = m.id === "cross" ? m.label : `${m.id} ${m.label}`;
    return {
      id: m.id,
      label,
      difficulty: m.difficulty,
      estimateH: m.estimateH,
      progressPct: pct(m.progress),
      done,
      remain,
    };
  });
  const totalEstimate = data.milestones.reduce((s, m) => s + m.estimateH, 0);
  const totalDone = data.milestones.reduce(
    (s, m) => s + m.estimateH * m.progress,
    0,
  );
  const totalRemain = totalEstimate - totalDone;
  const overallPct = pct(totalDone / totalEstimate);

  return { rows, totalEstimate, totalDone, totalRemain, overallPct };
}

/**
 * 健全性 KPI カード群（Rust/画面側テスト合計＋kpiExtra）を算出する。
 */
export function computeKpi(data) {
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
  return cards;
}

/**
 * 作業ボードの各カードの表示用アイコンボックス色を決める。
 */
export function laneColor(lane) {
  return LANE_COLOR[lane] || LANE_COLOR.eng;
}

/**
 * changelog の先頭（この版）と、それ以降（履歴として折りたたむ分）を分離する。
 */
export function splitChangelog(data) {
  const [current, ...history] = data.changelog;
  const historyItems = history.flatMap((entry) => entry.items);
  return { current, historyItems };
}
