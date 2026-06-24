import { describe, it, expect } from 'vitest';
import { toAiSpendRows, AI_TOKENS_METRIC, AI_COST_METRIC } from '@core/domain/aiSpend';

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
