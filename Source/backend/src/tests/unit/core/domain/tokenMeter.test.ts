import { describe, it, expect } from 'vitest';
import { TokenMeter } from '@core/domain/tokenMeter';

describe('TokenMeter', () => {
  it('starts at zero', () => {
    const meter = new TokenMeter();
    expect(meter.total).toBe(0);
    expect(meter.inputTotal).toBe(0);
    expect(meter.outputTotal).toBe(0);
    expect(meter.stageBreakdown()).toEqual([]);
  });

  it('sums input and output tokens across calls', () => {
    const meter = new TokenMeter();
    meter.record('VISION_PARSE', 1200, 300);
    meter.record('EMBEDDING', 40, 0);
    expect(meter.total).toBe(1540);
    expect(meter.inputTotal).toBe(1240);
    expect(meter.outputTotal).toBe(300);
  });

  it('groups tokens per stage, accumulating repeated stages', () => {
    const meter = new TokenMeter();
    meter.record('VISION_PARSE', 1000, 200);
    meter.record('MERCHANT_FALLBACK', 50, 30);
    meter.record('MERCHANT_FALLBACK', 10, 5);
    expect(meter.stageBreakdown()).toEqual([
      { stage: 'VISION_PARSE', inputTokens: 1000, outputTokens: 200 },
      { stage: 'MERCHANT_FALLBACK', inputTokens: 60, outputTokens: 35 },
    ]);
  });
});
