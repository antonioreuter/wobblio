import { describe, it, expect } from 'vitest';
import { detectAmbiguity } from '@core/domain/priceAmbiguity';

const cfg = { gapPct: 0.4 };

describe('detectAmbiguity', () => {
  it('flags a bimodal cell where both clusters are dense and far apart (12-pack vs 2L cola)', () => {
    // low cluster ~0.99, high cluster ~2.49 — gap far above 40%.
    const prices = [0.95, 0.99, 1.0, 2.4, 2.49, 2.5];
    const result = detectAmbiguity(prices, cfg);
    expect(result.ambiguous).toBe(true);
    expect(result.low).toBeCloseTo(0.99, 2);
    expect(result.high).toBeCloseTo(2.49, 2);
  });

  it('does not flag a tight unimodal cell (normal price drift)', () => {
    const prices = [1.0, 1.02, 1.05, 1.08, 1.1, 1.12];
    expect(detectAmbiguity(prices, cfg).ambiguous).toBe(false);
  });

  it('does not flag when a cluster is too sparse (<3 each side)', () => {
    // Only 5 points — one side has 2; density gate fails even though spread is large.
    const prices = [1.0, 1.0, 1.0, 2.5, 2.5];
    expect(detectAmbiguity(prices, cfg).ambiguous).toBe(false);
  });

  it('does not flag when the gap is below the threshold', () => {
    // 20% apart — below the 40% gap.
    const prices = [1.0, 1.0, 1.0, 1.2, 1.2, 1.2];
    expect(detectAmbiguity(prices, cfg).ambiguous).toBe(false);
  });

  it('respects a configurable gap (30% flags what 40% does not)', () => {
    const prices = [1.0, 1.0, 1.0, 1.35, 1.35, 1.35];
    expect(detectAmbiguity(prices, { gapPct: 0.4 }).ambiguous).toBe(false);
    expect(detectAmbiguity(prices, { gapPct: 0.3 }).ambiguous).toBe(true);
  });
});
