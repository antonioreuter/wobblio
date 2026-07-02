import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { ExtractionPreparer } from './ExtractionPreparer';
import type { InvoiceCoordinator } from './agentic/InvoiceCoordinator';
import type { InvoiceFinalizer, ExtractOutcome } from './InvoiceFinalizer';
import type { IngestionOutcome } from './IngestionService';

// The STRANDS pipeline (pipeline_type='STRANDS'). Same three phases as the legacy
// IngestionService — shared front (ExtractionPreparer: idempotency/parse/location), pipeline-
// specific canonicalization (here, the tool-based InvoiceCoordinator instead of direct service
// calls), shared tail (InvoiceFinalizer: persist/emit) — so the two pipelines are provably
// identical except for the extraction framing the A/B comparison (06) measures. Telemetry +
// charging are the worker's job, exactly as for the legacy worker.
export class AgenticIngestionService {
  constructor(
    private readonly preparer: ExtractionPreparer,
    private readonly coordinator: InvoiceCoordinator,
    private readonly finalizer: InvoiceFinalizer,
  ) {}

  async process(message: IngestionMessage): Promise<IngestionOutcome> {
    const result = await this.extract(message);
    if (result.kind === 'duplicate') return { handled: false };
    if (result.kind === 'unreadable') return result.outcome;
    return this.finalizer.finalize({ message, context: result.context, ...result.extraction });
  }

  // Shared front + tool-based coordinator, stopping before finalization — the dry-run seam the
  // evaluation harness (07) grades. process() is extract() + finalize().
  async extract(message: IngestionMessage): Promise<ExtractOutcome> {
    const prepared = await this.preparer.prepare(message);
    if (prepared.kind === 'duplicate') return { kind: 'duplicate' };
    if (prepared.kind === 'unreadable') return { kind: 'unreadable', outcome: prepared.outcome };
    const extraction = await this.coordinator.extract(prepared.receipt, prepared.location, message.invoiceId);
    return { kind: 'ready', extraction, context: prepared.context };
  }
}
