import type { IBusinessKpiSource } from '@core/ports/observability/IBusinessKpiSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';
import { toBusinessKpiRows } from '@core/domain/businessKpis';

// Rolls one day's cross-tenant business KPIs (registrations, DAU/MAU, premium,
// conversion, MRR proxy, feedback score) into kpi_daily (Epic 15).
export class BusinessKpiRollupService {
  constructor(
    private readonly source: IBusinessKpiSource,
    private readonly kpiWriter: IKpiDailyWriter,
  ) {}

  async run(metricDate: string): Promise<{ rowsWritten: number }> {
    const snapshot = await this.source.getSnapshot(metricDate);
    const rows = toBusinessKpiRows(metricDate, snapshot);
    await this.kpiWriter.upsert(rows);
    return { rowsWritten: rows.length };
  }
}
