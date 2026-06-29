import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { ExtractionPreparer } from './ExtractionPreparer';
import type { InvoiceCoordinator } from './agentic/InvoiceCoordinator';
import type { InvoiceFinalizer } from './InvoiceFinalizer';
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
    const prepared = await this.preparer.prepare(message);
    if (prepared.kind === 'duplicate') return { handled: false };
    if (prepared.kind === 'unreadable') return prepared.outcome;

    const extraction = await this.coordinator.extract(prepared.receipt, prepared.location);
    return this.finalizer.finalize({ message, context: prepared.context, ...extraction });
  }
}
