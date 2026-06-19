import type { IInvoiceRepository } from '@core/ports/ingestion/IInvoiceRepository';
import type { IInvoiceFeedbackRepository } from '@core/ports/ingestion/IInvoiceFeedbackRepository';
import { InvalidFeedbackError, InvoiceNotFoundError } from '@core/domain/errors';
import { isInvoiceVerdict } from '@core/domain/ingestion';

export class RecordFeedbackService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly feedbackRepo: IInvoiceFeedbackRepository,
  ) {}

  // Records the tenant's accuracy verdict on a parsed receipt. getById relies on
  // RLS, so a cross-tenant id resolves to null → not found.
  async record(invoiceId: string, verdict: string): Promise<void> {
    if (!isInvoiceVerdict(verdict)) throw new InvalidFeedbackError(verdict);

    const invoice = await this.invoiceRepo.getById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);

    await this.feedbackRepo.upsert(invoiceId, verdict);
  }
}
