import type { AgenticStage } from '@core/domain/agenticStage';
import type { IAgenticStageInstrumentation } from '@core/ports/observability/IAgenticStageInstrumentation';

// Stand-in for StructuredLogAgenticStageInstrumentation where no CloudWatch-bound structured
// log is wanted (local pipeline-evaluation harness). Mirrors MockPushAdapter's pattern of a
// plain console line instead of silent no-op, so a local eval run still shows stage timing.
export class MockAgenticStageInstrumentationAdapter implements IAgenticStageInstrumentation {
  recordStageOutcome(stage: AgenticStage, invoiceId: string, durationMs: number, error?: string): void {
    console.info(JSON.stringify({ event: 'mock_agentic_stage', stage, invoiceId, durationMs, error }));
  }
}
