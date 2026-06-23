import type { IAiUsageSource } from '@core/ports/observability/IAiUsageSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';
import { toAiSpendRows } from '@core/domain/aiSpend';

// Rolls one day's bedrock_usage logs into per-model-role token + estimated-cost rows
// in kpi_daily (Epic 15; read by the AI-spend dashboard, admin-console 07).
export class AiSpendRollupService {
  constructor(
    private readonly source: IAiUsageSource,
    private readonly kpiWriter: IKpiDailyWriter,
  ) {}

  async run(metricDate: string): Promise<{ rowsWritten: number }> {
    const stages = await this.source.getDailyTokensByStage(metricDate);
    if (stages.length === 0) return { rowsWritten: 0 };
    const rows = toAiSpendRows(metricDate, stages);
    await this.kpiWriter.upsert(rows);
    return { rowsWritten: rows.length };
  }
}
