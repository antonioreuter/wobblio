import { describe, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { BusinessKpiRollupService } from '@core/services/observability/BusinessKpiRollupService';
import type { IBusinessKpiSource } from '@core/ports/observability/IBusinessKpiSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';

describe('BusinessKpiRollupService', () => {
  it('reads the snapshot and upserts the derived kpi rows', async () => {
    const source: MockedObject<IBusinessKpiSource> = {
      getSnapshot: vi.fn().mockResolvedValue({
        registrations: 3,
        dau: 5,
        mau: 20,
        premiumCount: 2,
        activeUsers: 50,
        feedbackUp: 4,
        feedbackTotal: 5,
      }),
    };
    const writer: MockedObject<IKpiDailyWriter> = { upsert: vi.fn() };

    const { rowsWritten } = await new BusinessKpiRollupService(source, writer).run('2026-06-22');

    expect(source.getSnapshot).toHaveBeenCalledWith('2026-06-22');
    expect(writer.upsert).toHaveBeenCalledOnce();
    expect(rowsWritten).toBeGreaterThan(0);
  });
});
