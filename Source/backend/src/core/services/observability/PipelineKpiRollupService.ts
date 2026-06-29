import type { IPipelineKpiSource } from '@core/ports/observability/IPipelineKpiSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';
import { toPipelineKpiRows } from '@core/domain/pipelineKpis';

// Rolls one day of invoice_telemetry into per-pipeline kpi_daily rows (latency, cost per
// invoice, needs-review rate, feedback DOWN ratio) for the legacy-vs-Strands dashboard (06).
export class PipelineKpiRollupService {
  constructor(
    private readonly source: IPipelineKpiSource,
    private readonly kpiWriter: IKpiDailyWriter,
  ) {}

  async run(metricDate: string): Promise<{ rowsWritten: number }> {
    const aggregates = await this.source.getDailyByPipeline(metricDate);
    if (aggregates.length === 0) return { rowsWritten: 0 };

    const rows = toPipelineKpiRows(metricDate, aggregates);
    await this.kpiWriter.upsert(rows);
    return { rowsWritten: rows.length };
  }
}
