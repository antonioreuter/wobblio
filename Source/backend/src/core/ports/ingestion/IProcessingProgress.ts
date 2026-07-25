import type { ProcessingStage } from '../../domain/processingStage';

// Records which coarse stage an in-flight invoice has reached, so clients polling a PROCESSING
// row can render an honest label (fix 07/01).
//
// Contract, identical to IAgenticStageInstrumentation: this is best-effort telemetry for humans
// and MUST NEVER throw or otherwise change the ingestion outcome. Implementations swallow and
// log their own failures. It also must not run on the pipeline's transaction — the worker holds
// one long transaction whose writes stay invisible until COMMIT, which is exactly when progress
// stops mattering — so adapters take their own short-lived connection.
export interface IProcessingProgress {
  recordStage(invoiceId: string, tenantId: string, stage: ProcessingStage): Promise<void>;
}
