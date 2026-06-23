import type { IKpiDailyReader, KpiPoint } from '@core/ports/observability/IKpiDailyReader';
import { resolveRange } from '@core/domain/kpiRange';
import { BUSINESS_METRICS } from '@core/domain/businessKpis';

const DEFAULT_RANGE_DAYS = 90;
const DEFAULT_METRICS = Object.values(BUSINESS_METRICS);

export interface KpiQueryResult {
  from: string;
  to: string;
  metrics: string[];
  points: KpiPoint[];
}

// Read-only time-series over kpi_daily for the KPI dashboard (admin-console 08).
export class AdminKpiService {
  constructor(private readonly reader: IKpiDailyReader) {}

  async query(metricsCsv: string | undefined, from: string | undefined, to: string | undefined): Promise<KpiQueryResult> {
    const metrics = parseMetrics(metricsCsv);
    const range = resolveRange(from, to, DEFAULT_RANGE_DAYS);
    const points = await this.reader.query(metrics, range.from, range.to);
    return { ...range, metrics, points };
  }
}

function parseMetrics(csv: string | undefined): string[] {
  if (!csv) return DEFAULT_METRICS;
  const requested = csv.split(',').map((m) => m.trim()).filter(Boolean);
  return requested.length > 0 ? requested : DEFAULT_METRICS;
}
