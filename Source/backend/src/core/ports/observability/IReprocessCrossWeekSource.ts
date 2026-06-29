// One day's `reprocess cross week` worker logs, grouped by the week the reprocess charged
// (§07.5). Backs the kpi_daily rollup so cross-week reprocessing is trackable without EMF.
export interface CrossWeekTotal {
  chargedWeek: string; // YYYY-MM-DD (Monday-UTC week start)
  count: number;
  tokens: number;
}

export interface IReprocessCrossWeekSource {
  getDailyCrossWeekTotals(metricDate: string): Promise<CrossWeekTotal[]>;
}
