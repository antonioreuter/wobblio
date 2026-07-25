import { describe, it, expect } from 'vitest';
import {
  toVisionEscalationRows,
  ESCALATION_COUNT_METRIC,
  ESCALATION_USED_METRIC,
  ESCALATION_ERRORED_METRIC,
} from '@core/domain/visionEscalationKpi';
import type { VisionEscalationCount } from '@core/ports/observability/IVisionEscalationSource';

const find = (rows: ReturnType<typeof toVisionEscalationRows>, metric: string, dims: Record<string, string>) =>
  rows.find((r) => r.metricName === metric && JSON.stringify(r.dimensions) === JSON.stringify(dims));

describe('toVisionEscalationRows', () => {
  it('emits a count row per (tier, reason) with the tier and reason as dimensions', () => {
    const counts: VisionEscalationCount[] = [
      { ranTier: 'FALLBACK', reason: 'LOW_CONFIDENCE', usedFallback: true, fallbackErrored: false, count: 3 },
      { ranTier: 'FALLBACK_DEEP', reason: 'ARITHMETIC', usedFallback: true, fallbackErrored: false, count: 2 },
    ];

    const rows = toVisionEscalationRows('2026-07-18', counts);

    expect(find(rows, ESCALATION_COUNT_METRIC, { tier: 'FALLBACK', reason: 'LOW_CONFIDENCE' })?.value).toBe(3);
    expect(find(rows, ESCALATION_COUNT_METRIC, { tier: 'FALLBACK_DEEP', reason: 'ARITHMETIC' })?.value).toBe(2);
  });

  it('sums escalations of the same tier+reason across outcome variants into one count row', () => {
    const counts: VisionEscalationCount[] = [
      { ranTier: 'FALLBACK', reason: 'COVERAGE', usedFallback: true, fallbackErrored: false, count: 4 },
      { ranTier: 'FALLBACK', reason: 'COVERAGE', usedFallback: false, fallbackErrored: true, count: 1 },
    ];

    const rows = toVisionEscalationRows('2026-07-18', counts);

    expect(find(rows, ESCALATION_COUNT_METRIC, { tier: 'FALLBACK', reason: 'COVERAGE' })?.value).toBe(5);
  });

  it('tracks used and errored counts per tier', () => {
    const counts: VisionEscalationCount[] = [
      { ranTier: 'FALLBACK', reason: 'COVERAGE', usedFallback: true, fallbackErrored: false, count: 4 },
      { ranTier: 'FALLBACK', reason: 'BLURRY', usedFallback: false, fallbackErrored: true, count: 1 },
    ];

    const rows = toVisionEscalationRows('2026-07-18', counts);

    expect(find(rows, ESCALATION_USED_METRIC, { tier: 'FALLBACK' })?.value).toBe(4);
    expect(find(rows, ESCALATION_ERRORED_METRIC, { tier: 'FALLBACK' })?.value).toBe(1);
  });

  it('omits used/errored rows when no escalation had that outcome', () => {
    const counts: VisionEscalationCount[] = [
      { ranTier: 'FALLBACK', reason: 'LOW_CONFIDENCE', usedFallback: true, fallbackErrored: false, count: 2 },
    ];

    const rows = toVisionEscalationRows('2026-07-18', counts);

    expect(find(rows, ESCALATION_ERRORED_METRIC, { tier: 'FALLBACK' })).toBeUndefined();
  });

  it('skips rows without a tier', () => {
    const counts: VisionEscalationCount[] = [
      { ranTier: '', reason: 'LOW_CONFIDENCE', usedFallback: true, fallbackErrored: false, count: 9 },
    ];

    expect(toVisionEscalationRows('2026-07-18', counts)).toEqual([]);
  });
});
