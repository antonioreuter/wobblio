import { describe, it, expect } from 'vitest';
import {
  computeInflationSeries,
  mergeInflationSeries,
  type InflationSeriesPoint,
  type MonthlyProductMedian,
} from '@core/domain/inflationSeries';

const row = (period: string, productId: string, median: number): MonthlyProductMedian => ({
  period,
  productId,
  median,
});

describe('computeInflationSeries', () => {
  it('baselines the earliest month to 100 and indexes later months against it', () => {
    const rows = [
      row('2026-01', 'a', 100),
      row('2026-01', 'b', 100),
      row('2026-01', 'c', 100),
      // Feb: all three up 10% → median ratio 1.10 → index 110
      row('2026-02', 'a', 110),
      row('2026-02', 'b', 110),
      row('2026-02', 'c', 110),
    ];
    const series = computeInflationSeries(rows);
    expect(series).toEqual([
      { period: '2026-01', indexPct: 100 },
      { period: '2026-02', indexPct: 110 },
    ]);
  });

  it('matches each month against the baseline products only (matched basket)', () => {
    const rows = [
      row('2026-01', 'a', 100),
      row('2026-01', 'b', 100),
      row('2026-01', 'c', 100),
      // Feb introduces a new cheap product 'z' that is NOT in the baseline → ignored
      row('2026-02', 'a', 120),
      row('2026-02', 'b', 120),
      row('2026-02', 'c', 120),
      row('2026-02', 'z', 1),
    ];
    const series = computeInflationSeries(rows);
    expect(series[1]).toEqual({ period: '2026-02', indexPct: 120 });
  });

  it('emits a null point (never a fabricated value) when too few products match the baseline', () => {
    const rows = [
      row('2026-01', 'a', 100),
      row('2026-01', 'b', 100),
      row('2026-01', 'c', 100),
      row('2026-02', 'a', 110), // only 1 match < MIN(3)
    ];
    const series = computeInflationSeries(rows);
    expect(series[1]).toEqual({ period: '2026-02', indexPct: null });
  });

  it('is robust to one product spiking (median of ratios, not mean)', () => {
    const rows = [
      row('2026-01', 'a', 10),
      row('2026-01', 'b', 10),
      row('2026-01', 'c', 10),
      row('2026-02', 'a', 10),
      row('2026-02', 'b', 10),
      row('2026-02', 'c', 50), // one 5x spike
    ];
    // ratios 1,1,5 → median 1 → index 100
    expect(computeInflationSeries(rows)[1].indexPct).toBe(100);
  });

  it('returns empty for no rows', () => {
    expect(computeInflationSeries([])).toEqual([]);
  });

  it('orders points chronologically regardless of input order', () => {
    const rows = [
      row('2026-03', 'a', 120),
      row('2026-03', 'b', 120),
      row('2026-03', 'c', 120),
      row('2026-01', 'a', 100),
      row('2026-01', 'b', 100),
      row('2026-01', 'c', 100),
    ];
    const series = computeInflationSeries(rows);
    expect(series.map((p) => p.period)).toEqual(['2026-01', '2026-03']);
    expect(series[1].indexPct).toBe(120);
  });
});

describe('mergeInflationSeries', () => {
  const point = (period: string, indexPct: number | null): InflationSeriesPoint => ({
    period,
    indexPct,
  });

  it('overlays both series onto the sorted union of their months', () => {
    const personal = [point('2026-01', 100), point('2026-02', 105)];
    const region = [point('2026-02', 108), point('2026-03', 112)];
    expect(mergeInflationSeries(personal, region)).toEqual([
      { period: '2026-01', personalIndexPct: 100, regionIndexPct: null },
      { period: '2026-02', personalIndexPct: 105, regionIndexPct: 108 },
      { period: '2026-03', personalIndexPct: null, regionIndexPct: 112 },
    ]);
  });

  it('is empty when both series are empty', () => {
    expect(mergeInflationSeries([], [])).toEqual([]);
  });
});
