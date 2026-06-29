import { describe, it, expect } from 'vitest';
import {
  toReprocessCrossWeekRows,
  REPROCESS_CROSS_WEEK_COUNT_METRIC,
  REPROCESS_CROSS_WEEK_TOKENS_METRIC,
} from '@core/domain/reprocessKpi';

describe('toReprocessCrossWeekRows', () => {
  it('emits a count and a token row per charged week, dimensioned by week', () => {
    const rows = toReprocessCrossWeekRows('2026-06-29', [
      { chargedWeek: '2026-06-29', count: 2, tokens: 21000 },
      { chargedWeek: '2026-07-06', count: 1, tokens: 9000 },
    ]);

    expect(rows).toHaveLength(4);
    expect(rows).toContainEqual({
      metricDate: '2026-06-29', metricName: REPROCESS_CROSS_WEEK_COUNT_METRIC, value: 2, dimensions: { week: '2026-06-29' },
    });
    expect(rows).toContainEqual({
      metricDate: '2026-06-29', metricName: REPROCESS_CROSS_WEEK_TOKENS_METRIC, value: 21000, dimensions: { week: '2026-06-29' },
    });
  });

  it('returns no rows for an empty day', () => {
    expect(toReprocessCrossWeekRows('2026-06-29', [])).toEqual([]);
  });
});
