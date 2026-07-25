import type { IVisionEscalationSource } from '@core/ports/observability/IVisionEscalationSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';
import { toVisionEscalationRows } from '@core/domain/visionEscalationKpi';

// Rolls one day's vision_escalation logs into kpi_daily rows (fix 11 sub-spec 06) so
// escalation frequency and per-tier cost are monitorable from SQL after log retention.
export class VisionEscalationRollupService {
  constructor(
    private readonly source: IVisionEscalationSource,
    private readonly kpiWriter: IKpiDailyWriter,
  ) {}

  async run(metricDate: string): Promise<{ rowsWritten: number }> {
    const counts = await this.source.getDailyEscalations(metricDate);
    if (counts.length === 0) return { rowsWritten: 0 };
    const rows = toVisionEscalationRows(metricDate, counts);
    await this.kpiWriter.upsert(rows);
    return { rowsWritten: rows.length };
  }
}
