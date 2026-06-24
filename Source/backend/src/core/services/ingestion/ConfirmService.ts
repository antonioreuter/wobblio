import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IIngestionQueue } from '../../ports/ingestion/IIngestionQueue';
import { InvoiceNotFoundError, OversizeUploadError, StaleUploadError } from '../../domain/errors';
import { attachmentFormatFromKey } from '../../domain/uploadFormat';

// Bedrock Converse caps a document block at ~4.5 MB; reject oversize PDFs here so the
// user gets immediate feedback instead of a worker failure. Images are already
// compressed to ≤1 MB client-side.
const MAX_PDF_BYTES = 4_500_000;

export class ConfirmService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly fileStorage: IS3FileStorage,
    private readonly queue: IIngestionQueue,
  ) {}

  async confirm(invoiceId: string, tenantId: string): Promise<void> {
    const invoice = await this.invoiceRepo.getById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);

    const { exists, size } = await this.fileStorage.headObject(invoice.imageS3Key);
    if (!exists) throw new StaleUploadError(invoiceId);

    const isPdfUpload = attachmentFormatFromKey(invoice.imageS3Key) === 'pdf';
    if (isPdfUpload && size > MAX_PDF_BYTES) throw new OversizeUploadError(invoiceId, size, MAX_PDF_BYTES);

    await this.queue.enqueue({ invoiceId, tenantId, s3Key: invoice.imageS3Key });
  }
}
