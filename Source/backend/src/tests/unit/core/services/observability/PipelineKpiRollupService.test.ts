import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { PipelineKpiRollupService } from '@core/services/observability/PipelineKpiRollupService';
import type { IPipelineKpiSource } from '@core/ports/observability/IPipelineKpiSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';

describe('PipelineKpiRollupService', () => {
  let source: MockedObject<IPipelineKpiSource>;
  let writer: MockedObject<IKpiDailyWriter>;
  let sut: PipelineKpiRollupService;

  beforeEach(() => {
    source = { getDailyByPipeline: vi.fn() };
    writer = { upsert: vi.fn() };
    sut = new PipelineKpiRollupService(source, writer);
  });

  it('writes four metric rows per pipeline returned by the source', async () => {
    source.getDailyByPipeline.mockResolvedValue([
      { pipelineType: 'LEGACY', invoiceCount: 5, avgProcessingMs: 3000, avgCostUsd: 0.01, needsReviewCount: 1, feedbackDown: 0, feedbackRated: 2 },
      { pipelineType: 'STRANDS', invoiceCount: 4, avgProcessingMs: 2500, avgCostUsd: 0.02, needsReviewCount: 0, feedbackDown: 1, feedbackRated: 2 },
    ]);

    const result = await sut.run('2026-06-30');

    expect(result.rowsWritten).toBe(8);
    expect(writer.upsert).toHaveBeenCalledOnce();
    expect(writer.upsert.mock.calls[0][0]).toHaveLength(8);
  });

  it('writes nothing on a day with no telemetry', async () => {
    source.getDailyByPipeline.mockResolvedValue([]);

    const result = await sut.run('2026-06-30');

    expect(result.rowsWritten).toBe(0);
    expect(writer.upsert).not.toHaveBeenCalled();
  });
});
