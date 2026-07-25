import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { ExtractionPreparer } from './ExtractionPreparer';
import type { InvoiceCoordinator } from './agentic/InvoiceCoordinator';
import type { InvoiceFinalizer, ExtractOutcome, IngestionOutcome } from './InvoiceFinalizer';

// The ingestion pipeline (§6). Three phases: shared front (ExtractionPreparer:
// idempotency/parse/location), tool-based canonicalization (InvoiceCoordinator), shared tail
// (InvoiceFinalizer: persist/emit). Telemetry + charging are the worker's job.
export class AgenticIngestionService {
  constructor(
    private readonly preparer: ExtractionPreparer,
    private readonly coordinator: InvoiceCoordinator,
    private readonly finalizer: InvoiceFinalizer,
  ) {}

  async process(message: IngestionMessage): Promise<IngestionOutcome> {
    const result = await this.extract(message);
    if (result.kind === 'duplicate') return { handled: false };
    if (result.kind === 'unreadable' || result.kind === 'retake') return result.outcome;
    return this.finalizer.finalize({ message, context: result.context, ...result.extraction });
  }

  // Shared front + tool-based coordinator, stopping before finalization — the dry-run seam the
  // evaluation harness (07) grades. process() is extract() + finalize().
  async extract(message: IngestionMessage): Promise<ExtractOutcome> {
    const prepared = await this.preparer.prepare(message);
    if (prepared.kind === 'duplicate') return { kind: 'duplicate' };
    if (prepared.kind === 'unreadable') return { kind: 'unreadable', outcome: prepared.outcome };
    if (prepared.kind === 'retake') return { kind: 'retake', outcome: prepared.outcome };
    const extraction = await this.coordinator.extract(prepared.receipt, prepared.location, message.invoiceId);
    return { kind: 'ready', extraction, context: prepared.context };
  }
}
