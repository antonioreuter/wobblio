import type { InvoiceVerdict } from '@core/domain/ingestion';

export interface IInvoiceFeedbackRepository {
  // One verdict per (invoice, tenant): inserts or overwrites the existing rating.
  upsert(invoiceId: string, verdict: InvoiceVerdict): Promise<void>;
  // The tenant's current verdict for an invoice, or null if never rated.
  getVerdict(invoiceId: string): Promise<InvoiceVerdict | null>;
}
