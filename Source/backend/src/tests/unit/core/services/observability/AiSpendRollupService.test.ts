import { describe, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AiSpendRollupService } from '@core/services/observability/AiSpendRollupService';
import type { IAiUsageSource } from '@core/ports/observability/IAiUsageSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';

describe('AiSpendRollupService', () => {
  it('writes per-role rows when there is usage', async () => {
    const source: MockedObject<IAiUsageSource> = {
      getDailyTokensByStage: vi.fn().mockResolvedValue([
        { stage: 'VISION_PARSE', inputTokens: 100, outputTokens: 50 },
      ]),
    };
    const writer: MockedObject<IKpiDailyWriter> = { upsert: vi.fn() };

    const { rowsWritten } = await new AiSpendRollupService(source, writer).run('2026-06-22');

    expect(rowsWritten).toBeGreaterThan(0);
    expect(writer.upsert).toHaveBeenCalledOnce();
  });

  it('writes nothing on a day with no bedrock usage', async () => {
    const source: MockedObject<IAiUsageSource> = { getDailyTokensByStage: vi.fn().mockResolvedValue([]) };
    const writer: MockedObject<IKpiDailyWriter> = { upsert: vi.fn() };

    const { rowsWritten } = await new AiSpendRollupService(source, writer).run('2026-06-22');

    expect(rowsWritten).toBe(0);
    expect(writer.upsert).not.toHaveBeenCalled();
  });
});
