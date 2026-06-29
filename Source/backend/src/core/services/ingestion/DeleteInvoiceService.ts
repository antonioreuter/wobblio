import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IIngestionLedger } from '../../ports/ingestion/IIngestionLedger';
import { InvoiceBlockedError, InvoiceNotDeletableError, InvoiceNotFoundError } from '../../domain/errors';
import { isDeletable } from '../../domain/ingestion';

export class DeleteInvoiceService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly fileStorage: IS3FileStorage,
    private readonly ledger: IIngestionLedger,
  ) {}

  // Removes the receipt photo from S3 (data minimization) before hiding the
  // invoice, then releases the content-addressed ledger claim so a re-upload of the
  // same image can be processed again. Anonymized price observations already emitted
  // carry no invoice reference and are deliberately left untouched (invariants #2, #11).
  // getById relies on RLS, so a cross-tenant id resolves to null → not found.
  async delete(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepo.getById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);
    // A quarantined invoice is held for operator reprocessing; deleting it would also farm
    // a free re-scan. Checked first so it surfaces its own 409 (§03.5); isDeletable below
    // enforces the same hold for any other caller.
    if (invoice.systemFaultReason != null) throw new InvoiceBlockedError(invoiceId);
    if (!isDeletable(invoice.status, invoice.systemFaultReason)) throw new InvoiceNotDeletableError(invoiceId, invoice.status);

    await this.fileStorage.deleteObject(invoice.imageS3Key);
    await this.invoiceRepo.softDelete(invoiceId);
    await this.ledger.release(invoice.imageS3Key);
  }
}
