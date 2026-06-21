import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { IngestionMetricsRollupService } from '@core/services/observability/IngestionMetricsRollupService';
import type { IIngestionTimingSource } from '@core/ports/observability/IIngestionTimingSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';

const DATE = '2026-06-20';

describe('IngestionMetricsRollupService', () => {
  let timingSource: MockedObject<IIngestionTimingSource>;
  let kpiWriter: MockedObject<IKpiDailyWriter>;
  let sut: IngestionMetricsRollupService;

  beforeEach(() => {
    timingSource = { getDailyAverages: vi.fn() };
    kpiWriter = { upsert: vi.fn() };
    sut = new IngestionMetricsRollupService(timingSource, kpiWriter);
  });

  it('writes three metric rows per status, dimensioned by status', async () => {
    timingSource.getDailyAverages.mockResolvedValue([
      { status: 'PARSED', avgTotalMs: 4200, avgWorkerMs: 3100, count: 12 },
      { status: 'NEEDS_REVIEW', avgTotalMs: 5300, avgWorkerMs: 3900, count: 3 },
    ]);

    const { rowsWritten } = await sut.run(DATE);

    expect(rowsWritten).toBe(6);
    expect(kpiWriter.upsert).toHaveBeenCalledTimes(1);
    const rows = kpiWriter.upsert.mock.calls[0][0];
    expect(rows).toContainEqual({
      metricDate: DATE, metricName: 'ingestion_processing_ms_avg', value: 4200, dimensions: { status: 'PARSED' },
    });
    expect(rows).toContainEqual({
      metricDate: DATE, metricName: 'ingestion_worker_ms_avg', value: 3900, dimensions: { status: 'NEEDS_REVIEW' },
    });
    expect(rows).toContainEqual({
      metricDate: DATE, metricName: 'ingestion_count', value: 12, dimensions: { status: 'PARSED' },
    });
  });

  it('no-ops on a day with no timing data', async () => {
    timingSource.getDailyAverages.mockResolvedValue([]);

    const { rowsWritten } = await sut.run(DATE);

    expect(rowsWritten).toBe(0);
    expect(kpiWriter.upsert).not.toHaveBeenCalled();
  });
});
