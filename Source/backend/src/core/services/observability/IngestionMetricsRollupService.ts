import type { IIngestionTimingSource, TimingAggregate } from '../../ports/observability/IIngestionTimingSource';
import type { IKpiDailyWriter, KpiDailyRow } from '../../ports/observability/IKpiDailyWriter';

const PROCESSING_METRIC = 'ingestion_processing_ms_avg';
const WORKER_METRIC = 'ingestion_worker_ms_avg';
const COUNT_METRIC = 'ingestion_count';

// Rolls one day of ingestion-timing logs into per-status kpi_daily rows so the data
// survives log retention and is plottable straight from SQL.
export class IngestionMetricsRollupService {
  constructor(
    private readonly timingSource: IIngestionTimingSource,
    private readonly kpiWriter: IKpiDailyWriter,
  ) {}

  async run(metricDate: string): Promise<{ rowsWritten: number }> {
    const aggregates = await this.timingSource.getDailyAverages(metricDate);
    if (aggregates.length === 0) return { rowsWritten: 0 };

    const rows = aggregates.flatMap(agg => toKpiRows(metricDate, agg));
    await this.kpiWriter.upsert(rows);
    return { rowsWritten: rows.length };
  }
}

function toKpiRows(metricDate: string, agg: TimingAggregate): KpiDailyRow[] {
  const dimensions = { status: agg.status };
  return [
    { metricDate, metricName: PROCESSING_METRIC, value: agg.avgTotalMs, dimensions },
    { metricDate, metricName: WORKER_METRIC, value: agg.avgWorkerMs, dimensions },
    { metricDate, metricName: COUNT_METRIC, value: agg.count, dimensions },
  ];
}
