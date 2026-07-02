import type { AgenticStage } from '../../domain/agenticStage';

export interface AgenticStageFailure {
  invoiceId: string;
  message: string;
  timestamp: string;
}

export interface AgenticStageHealth {
  stage: AgenticStage;
  invocations: number;
  failures: number;
  avgDurationMs: number;
  lastFailure: AgenticStageFailure | null;
}

// Per-stage health for the agentic coordinator over a trailing window, derived from the
// `agentic_stage` structured logs (admin Troubleshooting page).
export interface IAgenticStageHealthSource {
  getStageHealth(minutes: number): Promise<AgenticStageHealth[]>;
}
