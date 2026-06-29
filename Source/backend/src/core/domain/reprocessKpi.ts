import type { CrossWeekTotal } from '@core/ports/observability/IReprocessCrossWeekSource';
import type { KpiDailyRow } from '@core/ports/observability/IKpiDailyWriter';

export const REPROCESS_CROSS_WEEK_COUNT_METRIC = 'reprocess_cross_week_count';
export const REPROCESS_CROSS_WEEK_TOKENS_METRIC = 'reprocess_cross_week_tokens';

// Maps per-charged-week cross-week-reprocess totals (§07.5) into kpi_daily rows: a count and
// a token sum per charged week, dimensioned by that week.
export function toReprocessCrossWeekRows(metricDate: string, totals: CrossWeekTotal[]): KpiDailyRow[] {
  const rows: KpiDailyRow[] = [];
  for (const t of totals) {
    const dimensions = { week: t.chargedWeek };
    rows.push({ metricDate, metricName: REPROCESS_CROSS_WEEK_COUNT_METRIC, value: t.count, dimensions });
    rows.push({ metricDate, metricName: REPROCESS_CROSS_WEEK_TOKENS_METRIC, value: t.tokens, dimensions });
  }
  return rows;
}
