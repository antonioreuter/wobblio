import type { AgenticStage } from '../../domain/agenticStage';

// Per-stage outcome sink for the agentic coordinator (Non-Functional 01, admin troubleshooting).
// Fire-and-forget: the adapter must never throw, so a logging failure can't affect ingestion.
export interface IAgenticStageInstrumentation {
  recordStageOutcome(stage: AgenticStage, invoiceId: string, durationMs: number, error?: string): void;
}
