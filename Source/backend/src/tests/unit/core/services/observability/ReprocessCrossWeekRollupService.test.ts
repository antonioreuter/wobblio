import { describe, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ReprocessCrossWeekRollupService } from '@core/services/observability/ReprocessCrossWeekRollupService';
import type { IReprocessCrossWeekSource } from '@core/ports/observability/IReprocessCrossWeekSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';

describe('ReprocessCrossWeekRollupService', () => {
  it('writes count + token rows when there were cross-week reprocesses', async () => {
    const source: MockedObject<IReprocessCrossWeekSource> = {
      getDailyCrossWeekTotals: vi.fn().mockResolvedValue([{ chargedWeek: '2026-06-29', count: 2, tokens: 21000 }]),
    };
    const writer: MockedObject<IKpiDailyWriter> = { upsert: vi.fn() };

    const { rowsWritten } = await new ReprocessCrossWeekRollupService(source, writer).run('2026-06-29');

    expect(rowsWritten).toBe(2);
    expect(writer.upsert).toHaveBeenCalledOnce();
  });

  it('writes nothing on a day with no cross-week reprocesses', async () => {
    const source: MockedObject<IReprocessCrossWeekSource> = { getDailyCrossWeekTotals: vi.fn().mockResolvedValue([]) };
    const writer: MockedObject<IKpiDailyWriter> = { upsert: vi.fn() };

    const { rowsWritten } = await new ReprocessCrossWeekRollupService(source, writer).run('2026-06-29');

    expect(rowsWritten).toBe(0);
    expect(writer.upsert).not.toHaveBeenCalled();
  });
});
