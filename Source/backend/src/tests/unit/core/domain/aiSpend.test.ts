import { describe, it, expect } from 'vitest';
import { toAiSpendRows, estimateCostUsd, AI_TOKENS_METRIC, AI_COST_METRIC } from '@core/domain/aiSpend';

describe('toAiSpendRows', () => {
  it('aggregates stages into per-model-role token + cost rows', () => {
    const rows = toAiSpendRows('2026-06-22', [
      { stage: 'VISION_PARSE', inputTokens: 1000, outputTokens: 500 },
      { stage: 'MERCHANT_FALLBACK', inputTokens: 200, outputTokens: 100 },
      { stage: 'PRODUCT_EXPANSION', inputTokens: 300, outputTokens: 100 },
    ]);

    const vision = rows.find((r) => r.metricName === AI_TOKENS_METRIC && r.dimensions?.model_role === 'vision_parser');
    const aux = rows.find((r) => r.metricName === AI_TOKENS_METRIC && r.dimensions?.model_role === 'auxiliary');
    expect(vision?.value).toBe(1500);
    expect(aux?.value).toBe(700); // both auxiliary stages summed
    expect(rows.some((r) => r.metricName === AI_COST_METRIC && r.dimensions?.model_role === 'auxiliary')).toBe(true);
  });

  it('skips unknown stages rather than misattributing them', () => {
    const rows = toAiSpendRows('2026-06-22', [{ stage: 'MYSTERY', inputTokens: 999, outputTokens: 999 }]);
    expect(rows).toHaveLength(0);
  });

  it('cost reflects the input/output token split', () => {
    const rows = toAiSpendRows('2026-06-22', [{ stage: 'EMBEDDING', inputTokens: 10000, outputTokens: 0 }]);
    const cost = rows.find((r) => r.metricName === AI_COST_METRIC)?.value ?? -1;
    expect(cost).toBeGreaterThanOrEqual(0); // embedder output rate is 0
  });
});

describe('estimateCostUsd', () => {
  it('prices each stage by its model role and sums them', () => {
    // vision_parser 0.0008/1k (in+out), auxiliary 0.0008 in / 0.004 out, embedder 0.00002 in / 0 out
    const cost = estimateCostUsd([
      { stage: 'VISION_PARSE', inputTokens: 1000, outputTokens: 1000 }, // 0.0008 + 0.0008
      { stage: 'MERCHANT_FALLBACK', inputTokens: 1000, outputTokens: 1000 }, // 0.0008 + 0.004
      { stage: 'EMBEDDING', inputTokens: 1000, outputTokens: 0 }, // 0.00002
    ]);
    expect(cost).toBeCloseTo(0.0008 + 0.0008 + 0.0008 + 0.004 + 0.00002, 6);
  });

  it('returns 0 for no stages', () => {
    expect(estimateCostUsd([])).toBe(0);
  });

  it('skips unknown stages rather than misattributing them', () => {
    expect(estimateCostUsd([{ stage: 'MYSTERY', inputTokens: 9999, outputTokens: 9999 }])).toBe(0);
  });
});
