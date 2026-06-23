import type { IKpiDailyReader, KpiPoint } from '@core/ports/observability/IKpiDailyReader';
import { resolveRange } from '@core/domain/kpiRange';
import { AI_TOKENS_METRIC, AI_COST_METRIC } from '@core/domain/aiSpend';

const DEFAULT_RANGE_DAYS = 30;

export interface AiSpendResult {
  from: string;
  to: string;
  points: KpiPoint[]; // ai_tokens / ai_cost rows, each carrying { model_role } in dimensions
}

// Aggregate-only AI-spend over kpi_daily (admin-console 07). The per-tenant ledger +
// cap were removed (2026-06-22) — this reads the nightly per-model-role rollup only.
export class AdminAiSpendService {
  constructor(private readonly reader: IKpiDailyReader) {}

  async query(from: string | undefined, to: string | undefined): Promise<AiSpendResult> {
    const range = resolveRange(from, to, DEFAULT_RANGE_DAYS);
    const points = await this.reader.query([AI_TOKENS_METRIC, AI_COST_METRIC], range.from, range.to);
    return { ...range, points };
  }
}
