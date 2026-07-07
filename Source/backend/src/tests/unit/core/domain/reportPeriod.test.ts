import { describe, it, expect } from 'vitest';
import { resolvePeriod, isSpendPeriodPreset, MAX_SPEND_RANGE_DAYS } from '@core/domain/reportPeriod';
import { InvalidSpendReportQueryError } from '@core/domain/errors';

// Fixed "now": Wednesday 2026-07-08 (UTC). Monday of that week is 2026-07-06.
const NOW = new Date('2026-07-08T13:30:00Z');

describe('resolvePeriod', () => {
  it('THIS_WEEK spans Monday→tomorrow (exclusive)', () => {
    expect(resolvePeriod('THIS_WEEK', null, null, NOW)).toEqual({ from: '2026-07-06', to: '2026-07-09' });
  });

  it('THIS_MONTH spans the 1st→tomorrow (exclusive)', () => {
    expect(resolvePeriod('THIS_MONTH', null, null, NOW)).toEqual({ from: '2026-07-01', to: '2026-07-09' });
  });

  it('LAST_90D spans exactly 90 days inclusive of today', () => {
    const { from, to } = resolvePeriod('LAST_90D', null, null, NOW);
    expect(to).toBe('2026-07-09'); // tomorrow, exclusive
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    expect(days).toBe(MAX_SPEND_RANGE_DAYS);
  });

  it('CUSTOM makes the picked (inclusive) end exclusive', () => {
    expect(resolvePeriod('CUSTOM', '2026-06-01', '2026-06-30', NOW)).toEqual({ from: '2026-06-01', to: '2026-07-01' });
  });

  it('CUSTOM rejects a range beyond the 90-day cap', () => {
    expect(() => resolvePeriod('CUSTOM', '2026-01-01', '2026-06-30', NOW)).toThrow(InvalidSpendReportQueryError);
  });

  it('CUSTOM allows exactly 90 days', () => {
    // 2026-04-02 .. 2026-06-30 inclusive = 90 days.
    expect(() => resolvePeriod('CUSTOM', '2026-04-02', '2026-06-30', NOW)).not.toThrow();
  });

  it('CUSTOM rejects reversed dates', () => {
    expect(() => resolvePeriod('CUSTOM', '2026-06-30', '2026-06-01', NOW)).toThrow(InvalidSpendReportQueryError);
  });

  it('CUSTOM requires both bounds', () => {
    expect(() => resolvePeriod('CUSTOM', '2026-06-01', null, NOW)).toThrow(InvalidSpendReportQueryError);
  });

  it('CUSTOM rejects a malformed date', () => {
    expect(() => resolvePeriod('CUSTOM', '2026/06/01', '2026-06-30', NOW)).toThrow(InvalidSpendReportQueryError);
  });
});

describe('isSpendPeriodPreset', () => {
  it('accepts the four presets and rejects anything else', () => {
    expect(isSpendPeriodPreset('LAST_90D')).toBe(true);
    expect(isSpendPeriodPreset('YTD')).toBe(false);
  });
});
