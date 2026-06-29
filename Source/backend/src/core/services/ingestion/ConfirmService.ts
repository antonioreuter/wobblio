import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IIngestionQueue } from '../../ports/ingestion/IIngestionQueue';
import { InvoiceNotFoundError, StaleUploadError } from '../../domain/errors';

export class ConfirmService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly fileStorage: IS3FileStorage,
    private readonly queue: IIngestionQueue,
  ) {}

  async confirm(invoiceId: string, tenantId: string): Promise<void> {
    const invoice = await this.invoiceRepo.getById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);

    // Size is now enforced at presign (S3 content-length-range) and re-checked at worker
    // start (§06), so no byte guard here — just confirm the object actually landed.
    const { exists } = await this.fileStorage.headObject(invoice.imageS3Key);
    if (!exists) throw new StaleUploadError(invoiceId);

    await this.queue.enqueue({ invoiceId, tenantId, s3Key: invoice.imageS3Key });
  }
}
