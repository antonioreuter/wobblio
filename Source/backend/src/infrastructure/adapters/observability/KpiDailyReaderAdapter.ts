import type { Pool, PoolClient } from 'pg';
import type { IKpiDailyReader, KpiPoint } from '@core/ports/observability/IKpiDailyReader';

interface KpiDbRow {
  metric_date: Date;
  metric_name: string;
  value: string;
  dimensions: Record<string, string> | null;
}

// kpi_daily is global (no RLS) — no tenant context required.
export class KpiDailyReaderAdapter implements IKpiDailyReader {
  constructor(private readonly pool: Pool | PoolClient) {}

  async query(metricNames: string[], from: string, to: string): Promise<KpiPoint[]> {
    const result = await this.pool.query<KpiDbRow>(
      `SELECT metric_date, metric_name, value, dimensions
       FROM kpi_daily
       WHERE metric_name = ANY($1) AND metric_date BETWEEN $2 AND $3
       ORDER BY metric_date ASC`,
      [metricNames, from, to],
    );
    return result.rows.map((r) => ({
      metricDate: r.metric_date.toISOString().slice(0, 10),
      metricName: r.metric_name,
      value: Number(r.value),
      dimensions: r.dimensions,
    }));
  }
}
