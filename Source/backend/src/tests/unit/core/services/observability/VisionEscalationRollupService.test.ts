import { describe, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { VisionEscalationRollupService } from '@core/services/observability/VisionEscalationRollupService';
import type { IVisionEscalationSource } from '@core/ports/observability/IVisionEscalationSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';

describe('VisionEscalationRollupService', () => {
  it('writes rows when there were escalations', async () => {
    const source: MockedObject<IVisionEscalationSource> = {
      getDailyEscalations: vi.fn().mockResolvedValue([
        { ranTier: 'FALLBACK', reason: 'LOW_CONFIDENCE', usedFallback: true, fallbackErrored: false, count: 3 },
      ]),
    };
    const writer: MockedObject<IKpiDailyWriter> = { upsert: vi.fn() };

    const { rowsWritten } = await new VisionEscalationRollupService(source, writer).run('2026-07-18');

    expect(rowsWritten).toBeGreaterThan(0);
    expect(writer.upsert).toHaveBeenCalledOnce();
  });

  it('writes nothing on a day with no escalations', async () => {
    const source: MockedObject<IVisionEscalationSource> = { getDailyEscalations: vi.fn().mockResolvedValue([]) };
    const writer: MockedObject<IKpiDailyWriter> = { upsert: vi.fn() };

    const { rowsWritten } = await new VisionEscalationRollupService(source, writer).run('2026-07-18');

    expect(rowsWritten).toBe(0);
    expect(writer.upsert).not.toHaveBeenCalled();
  });
});
