import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import { InvoiceNotFoundError } from '../../domain/errors';

export class DeleteInvoiceService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly fileStorage: IS3FileStorage,
  ) {}

  // Removes the receipt photo from S3 (data minimization) before hiding the
  // invoice. Anonymized price observations already emitted carry no invoice
  // reference and are deliberately left untouched (invariants #2, #11).
  // getById relies on RLS, so a cross-tenant id resolves to null → not found.
  async delete(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepo.getById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);

    await this.fileStorage.deleteObject(invoice.imageS3Key);
    await this.invoiceRepo.softDelete(invoiceId);
  }
}
