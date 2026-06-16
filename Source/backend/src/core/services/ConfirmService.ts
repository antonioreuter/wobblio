import type { IInvoiceRepository } from '../ports/IInvoiceRepository';
import type { IS3FileStorage } from '../ports/IS3FileStorage';
import type { IIngestionQueue } from '../ports/IIngestionQueue';
import { InvoiceNotFoundError, StaleUploadError } from '../domain/errors';

export class ConfirmService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly fileStorage: IS3FileStorage,
    private readonly queue: IIngestionQueue,
  ) {}

  async confirm(invoiceId: string, tenantId: string): Promise<void> {
    const invoice = await this.invoiceRepo.getById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);

    const uploaded = await this.fileStorage.headExists(invoice.imageS3Key);
    if (!uploaded) throw new StaleUploadError(invoiceId);

    await this.queue.enqueue({ invoiceId, tenantId, s3Key: invoice.imageS3Key });
  }
}
