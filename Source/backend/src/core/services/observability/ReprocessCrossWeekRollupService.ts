import type { IReprocessCrossWeekSource } from '@core/ports/observability/IReprocessCrossWeekSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';
import { toReprocessCrossWeekRows } from '@core/domain/reprocessKpi';

// Rolls one day's `reprocess cross week` logs into kpi_daily count + token rows per charged
// week (§07.5; read by the admin ops view). The fourth rollup in cron-ingestion-metrics-rollup.
export class ReprocessCrossWeekRollupService {
  constructor(
    private readonly source: IReprocessCrossWeekSource,
    private readonly kpiWriter: IKpiDailyWriter,
  ) {}

  async run(metricDate: string): Promise<{ rowsWritten: number }> {
    const totals = await this.source.getDailyCrossWeekTotals(metricDate);
    if (totals.length === 0) return { rowsWritten: 0 };
    const rows = toReprocessCrossWeekRows(metricDate, totals);
    await this.kpiWriter.upsert(rows);
    return { rowsWritten: rows.length };
  }
}
