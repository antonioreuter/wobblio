import type { IQueueHealthSource, QueueHealth } from '@core/ports/troubleshooting/IQueueHealthSource';
import type { AgenticStageHealth, IAgenticStageHealthSource } from '@core/ports/observability/IAgenticStageHealthSource';

export interface AgenticPipelineHealth {
  queueHealth: QueueHealth;
  stages: AgenticStageHealth[];
}

// Operator triage for the agentic (STRANDS) pipeline: queue depth alongside per-stage
// invocation/failure/latency, so "is it healthy, and which component is failing" is one call.
export class AgenticPipelineHealthService {
  constructor(
    private readonly queues: IQueueHealthSource,
    private readonly stageHealth: IAgenticStageHealthSource,
  ) {}

  async getHealth(minutes: number): Promise<AgenticPipelineHealth> {
    const [queueHealth, stages] = await Promise.all([
      this.queues.getHealth(),
      this.stageHealth.getStageHealth(minutes),
    ]);
    return { queueHealth, stages };
  }
}
