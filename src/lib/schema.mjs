// dashboard/status.json の zod スキーマ。
// generate-dashboard.mjs 時代の暗黙の型付けを明示化し、必須フィールド欠落や
// 範囲外の値（例: progress が 0-1 の範囲外）を NaN の静かな漏出でなく
// 明確なエラーメッセージで止める。
//
// 設計方針（.kiro/steering/operations.md 参照）:
// - status.json が唯一の真実。
// - 節目(milestones)が単一の真実。見積もりKPI・見積もり内訳表・節目カードの bar は
//   すべて difficulty/estimateH/progress から算出する（二重入力しない）。

import { z } from "zod";

const EVIDENCE_KINDS = ["auto-test", "manual-visual", "live-api", "po-signoff"];
const TONES = ["ok", "warn", "bad", "mute", "info", "upd"];
const LANES = ["design", "eng"];

const badgeSchema = z.object({
  text: z.string(),
  tone: z.enum(TONES),
});

const evidenceSchema = z.array(z.enum(EVIDENCE_KINDS)).default([]);

const milestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  title: z.string(),
  difficulty: z.number().min(1).max(5),
  estimateH: z.number().min(0),
  progress: z.number().min(0).max(1),
  badge: badgeSchema,
  note: z.string().optional(),
  remainingNote: z.string().optional(),
  hideCard: z.boolean().optional(),
  evidence: evidenceSchema,
});

const specSchema = z.object({
  // ボード→spec リンク（Wave3 #3）: board カードから同一ページ内の spec 表の
  // 該当行アンカー（#spec-<id>）へリンクするための安定 id。既存データとの
  // 後方互換のため optional（無ければ該当specへはリンクされないだけで表自体の
  // 表示は変わらない）。
  id: z.string().optional(),
  name: z.string(),
  stage: z.string(),
  impl: z.string(),
  rustTests: z.number().nullable().optional(),
  screenTests: z.number().nullable().optional(),
  screenTestsNote: z.string().optional(),
  badge: badgeSchema,
  evidence: evidenceSchema,
});

const sharedTestsSchema = z.object({
  rust: z.number().min(0),
  screen: z.number().min(0),
  note: z.string(),
});

const kpiExtraSchema = z.object({
  value: z.union([z.number(), z.string()]),
  label: z.string(),
  tone: z.string(),
  note: z.string(),
});

const boardCardSchema = z.object({
  id: z.string(),
  lane: z.enum(LANES),
  title: z.string(),
  note: z.string().optional(),
  actors: z.string().optional(),
  actorsTip: z.string().optional(),
  tip: z.string(),
  footnote: z.string().optional(),
  // ボード→spec リンク（Wave3 #3）: specs[].id と一致する値を指定すると、
  // このカードから spec 表の該当行アンカーへリンクする。任意項目
  // （すべてのカードが spec に対応するわけではない：例 V1 は実機目視タスクで
  // 単一 spec に紐づかない）。
  specRef: z.string().optional(),
});

const boardLanesSchema = z.object({
  waiting: z.array(boardCardSchema),
  inProgress: z.array(boardCardSchema),
  review: z.array(boardCardSchema),
  done: z.array(boardCardSchema),
});

const boardSchema = z.object({
  updatedLabel: z.string(),
  headline: z.string(),
  lanes: boardLanesSchema,
  nextCandidates: z.string(),
  carryover: z.string(),
});

const incidentSchema = z.object({
  issue: z.string(),
  fix: z.string(),
  effect: z.string(),
});

const signalSchema = z.object({
  signal: z.string(),
  status: z.string(),
});

const operationsSchema = z.object({
  intro: z.string(),
  delegated: z.number(),
  accepted: z.number(),
  discarded: z.number(),
  reviews: z.number(),
  incidents: z.array(incidentSchema),
  verdictsSummary: z.string(),
  disclosureIntro: z.string(),
  signals: z.array(signalSchema),
  disciplineNote: z.string(),
  consultNote: z.string(),
  registryNote: z.string(),
});

const nextActionsSchema = z.object({
  high: z.array(z.string()),
  watch: z.array(z.string()),
});

const changelogEntrySchema = z.object({
  date: z.string(),
  items: z.array(z.string()),
});

export const statusSchema = z.object({
  branch: z.string(),
  milestones: z.array(milestoneSchema).min(1),
  specs: z.array(specSchema),
  sharedTests: sharedTestsSchema,
  kpiExtra: z.array(kpiExtraSchema),
  board: boardSchema,
  operations: operationsSchema,
  nextActions: nextActionsSchema,
  changelog: z.array(changelogEntrySchema).min(1),
});

/**
 * status.json のデータを検証する。失敗時はエラーを投げる（明確な失敗を優先し、
 * 不正データのまま生成を続行しない）。
 *
 * zod の ZodError をそのまま投げると、Astro のエラー表示経路で `.message` が
 * "Required" の1語だけに切り詰められ、どのフィールドが問題かわからなくなる
 * ことが独立レビューで判明した。そのため issues を1件ずつ整形して
 * console.error に出したうえで、整形済みメッセージを持つ通常の Error を
 * 投げ直す（ビルドは引き続き失敗する＝NaN の静かな漏出は防いだまま）。
 */
export function parseStatus(rawData) {
  const result = statusSchema.safeParse(rawData);
  if (result.success) {
    return result.data;
  }

  const lines = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  const formatted = [
    "dashboard/status.json の検証に失敗しました（zod）。以下のフィールドを確認してください:",
    ...lines,
  ].join("\n");

  console.error(formatted);
  throw new Error(formatted);
}
