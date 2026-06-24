// Read side of kpi_daily (global, no RLS) for the admin dashboards (admin-console
// 07/08). Returns a flat time series the UI groups/plots.
export interface KpiPoint {
  metricDate: string; // YYYY-MM-DD
  metricName: string;
  value: number;
  dimensions: Record<string, string> | null;
}

export interface IKpiDailyReader {
  query(metricNames: string[], from: string, to: string): Promise<KpiPoint[]>;
}
