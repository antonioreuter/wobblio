import type { ModelRole } from '@core/ports/ai/IModelRegistry';
import type { StageTokenTotals } from '@core/ports/observability/IAiUsageSource';
import type { KpiDailyRow } from '@core/ports/observability/IKpiDailyWriter';

export const AI_TOKENS_METRIC = 'ai_tokens';
export const AI_COST_METRIC = 'ai_cost';

// Each Bedrock pipeline stage invokes one model role. (insight/Sonnet has no live
// stage today — it will simply produce no rows until a stage uses it.)
const STAGE_ROLE: Record<string, ModelRole> = {
  VISION_PARSE: 'vision_parser',
  EMBEDDING: 'embedder',
  MERCHANT_FALLBACK: 'auxiliary',
  PRODUCT_EXPANSION: 'auxiliary',
  CLASSIFICATION_TIEBREAK: 'auxiliary',
  WEEKLY_ADVISOR: 'auxiliary',
};

// Estimated USD per 1k tokens by role (input, output). Rough class-based estimates —
// the dashboard presents the result as an estimate, not a billed figure.
const RATE_PER_1K: Record<ModelRole, { input: number; output: number }> = {
  vision_parser: { input: 0.0008, output: 0.0008 },
  pdf_parser: { input: 0.003, output: 0.015 },
  auxiliary: { input: 0.0008, output: 0.004 },
  insight: { input: 0.003, output: 0.015 },
  embedder: { input: 0.00002, output: 0 },
};

interface RoleTotals {
  tokens: number;
  cost: number;
}

function costForStage(stage: StageTokenTotals): number {
  const role = STAGE_ROLE[stage.stage];
  if (!role) return 0; // unknown stage — skip rather than misattribute
  const rate = RATE_PER_1K[role];
  return (stage.inputTokens / 1000) * rate.input + (stage.outputTokens / 1000) * rate.output;
}

// Estimated USD cost of one ingestion run from its per-stage token totals, priced per
// model role. Single pricing source (RATE_PER_1K) — the per-invoice telemetry write path
// (non-functional 01) and the daily rollup both go through here.
export function estimateCostUsd(stages: StageTokenTotals[]): number {
  return round(stages.reduce((sum, s) => sum + costForStage(s), 0));
}

// Aggregates per-stage token totals into per-model-role kpi_daily rows (tokens +
// estimated cost), the shape the AI-spend dashboard reads (admin-console 07).
export function toAiSpendRows(metricDate: string, stages: StageTokenTotals[]): KpiDailyRow[] {
  const byRole = new Map<ModelRole, RoleTotals>();
  for (const s of stages) {
    const role = STAGE_ROLE[s.stage];
    if (!role) continue; // unknown stage — skip rather than misattribute
    const acc = byRole.get(role) ?? { tokens: 0, cost: 0 };
    acc.tokens += s.inputTokens + s.outputTokens;
    acc.cost += costForStage(s);
    byRole.set(role, acc);
  }

  const rows: KpiDailyRow[] = [];
  for (const [role, totals] of byRole) {
    const dimensions = { model_role: role };
    rows.push({ metricDate, metricName: AI_TOKENS_METRIC, value: totals.tokens, dimensions });
    rows.push({ metricDate, metricName: AI_COST_METRIC, value: round(totals.cost), dimensions });
  }
  return rows;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
