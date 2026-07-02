import { describe, it, expect, vi } from 'vitest';
import { AgenticPipelineHealthService } from '@core/services/admin/AgenticPipelineHealthService';
import type { IQueueHealthSource } from '@core/ports/troubleshooting/IQueueHealthSource';
import type { IAgenticStageHealthSource, AgenticStageHealth } from '@core/ports/observability/IAgenticStageHealthSource';

describe('AgenticPipelineHealthService', () => {
  it('combines queue depth and per-stage health from both sources', async () => {
    const queues: IQueueHealthSource = {
      getHealth: vi.fn().mockResolvedValue({ queueDepth: 2, inFlight: 1, dlqDepth: 0 }),
    };
    const stages: AgenticStageHealth[] = [
      { stage: 'MERCHANT_RESOLUTION', invocations: 10, failures: 0, avgDurationMs: 120, lastFailure: null },
      { stage: 'PRODUCT_NORMALIZATION', invocations: 10, failures: 2, avgDurationMs: 340, lastFailure: { invoiceId: 'inv-9', message: 'timeout', timestamp: '2026-07-02T10:00:00.000Z' } },
    ];
    const stageHealth: IAgenticStageHealthSource = { getStageHealth: vi.fn().mockResolvedValue(stages) };

    const service = new AgenticPipelineHealthService(queues, stageHealth);
    const result = await service.getHealth(60);

    expect(queues.getHealth).toHaveBeenCalled();
    expect(stageHealth.getStageHealth).toHaveBeenCalledWith(60);
    expect(result).toEqual({
      queueHealth: { queueDepth: 2, inFlight: 1, dlqDepth: 0 },
      stages,
    });
  });
});
