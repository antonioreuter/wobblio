import type { Pool } from 'pg';
import type { IKpiDailyWriter, KpiDailyRow } from '@core/ports/observability/IKpiDailyWriter';

// kpi_daily is a global table (no RLS) — no tenant context needed. The ON CONFLICT
// target matches the expression unique index (metric_date, metric_name,
// COALESCE(dimensions::text,'')), so a re-run of the same day overwrites in place.
const UPSERT_SQL = `
  INSERT INTO kpi_daily (metric_date, metric_name, value, dimensions)
  VALUES ($1, $2, $3, $4::jsonb)
  ON CONFLICT (metric_date, metric_name, (COALESCE(dimensions::text, '')))
  DO UPDATE SET value = EXCLUDED.value`;

export class KpiDailyRepositoryAdapter implements IKpiDailyWriter {
  constructor(private readonly pool: Pool) {}

  async upsert(rows: KpiDailyRow[]): Promise<void> {
    for (const row of rows) {
      await this.pool.query(UPSERT_SQL, [
        row.metricDate,
        row.metricName,
        row.value,
        row.dimensions ? JSON.stringify(row.dimensions) : null,
      ]);
    }
  }
}
