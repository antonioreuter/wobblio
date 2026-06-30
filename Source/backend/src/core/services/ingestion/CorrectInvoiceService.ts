import type { CorrectInvoiceInput, IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import { isCorrectable } from '../../domain/ingestion';
import {
  InvalidCorrectionError,
  InvoiceNotCorrectableError,
  InvoiceNotFoundError,
} from '../../domain/errors';

// Mobile 16e — persists the review screen's corrections. Flips the invoice to PARSED
// and stamps it user-corrected so the (deferred) price-observation emission marks its
// rows USER_CONFIRMED (§6.5). getById relies on RLS, so a cross-tenant id resolves to
// null → not found.
export class CorrectInvoiceService {
  constructor(private readonly invoiceRepo: IInvoiceRepository) {}

  async correct(input: CorrectInvoiceInput): Promise<void> {
    this.validate(input);

    const invoice = await this.invoiceRepo.getById(input.invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(input.invoiceId);
    if (!isCorrectable(invoice.status)) {
      throw new InvoiceNotCorrectableError(input.invoiceId, invoice.status);
    }

    await this.invoiceRepo.applyCorrection(input);
  }

  private validate(input: CorrectInvoiceInput): void {
    if (input.total !== null && input.total < 0) {
      throw new InvalidCorrectionError('total must not be negative');
    }
    for (const line of input.lines) {
      if (line.quantity <= 0) throw new InvalidCorrectionError('line quantity must be positive');
      if (line.lineTotal < 0) throw new InvalidCorrectionError('line total must not be negative');
    }
  }
}
