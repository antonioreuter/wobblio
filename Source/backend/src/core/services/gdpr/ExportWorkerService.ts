import type { IDataRequestRepository } from '../../ports/gdpr/IDataRequestRepository';
import type { IExportDataSource, ReceiptImageRef } from '../../ports/gdpr/IExportDataSource';
import type { IArchiveUploader } from '../../ports/gdpr/IArchiveUploader';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IZipArchiver, ArchiveEntry } from '../../ports/admin/IZipArchiver';
import { DataRequestNotFoundError } from '../../domain/errors';
import { toCsv } from '../../domain/csv';
import { attachmentFormatFromKey } from '../../domain/uploadFormat';
import { fetchBytesTolerantly } from '../../domain/tolerantFetch';

// Bounds peak concurrent S3 GetObject calls (and their in-flight buffers) for tenants with a
// large receipt history — a multi-year/household export can have thousands of images.
const IMAGE_FETCH_CONCURRENCY = 25;

export class ExportWorkerService {
  constructor(
    private readonly requests: IDataRequestRepository,
    private readonly dataSource: IExportDataSource,
    private readonly uploadsStorage: IS3FileStorage,
    private readonly exportsStorage: IArchiveUploader,
    private readonly zipper: IZipArchiver,
  ) {}

  // Idempotent: claimForProcessing atomically flips PENDING|FAILED -> PROCESSING, so a
  // redelivered SQS message either for an already-COMPLETED request or one still mid-flight
  // (already PROCESSING) loses the claim and no-ops instead of reprocessing/double-notifying.
  // Returns the tenant's email alongside the key so the Lambda's post-commit notify step needs
  // no extra query.
  async run(requestId: string, tenantId: string): Promise<{ s3Key: string; email: string } | null> {
    const request = await this.requests.getExportById(requestId);
    if (!request) throw new DataRequestNotFoundError(requestId);
    if (!(await this.requests.claimForProcessing(requestId))) return null;

    const [account, invoices, invoiceLines, shoppingLists, budgets, imageRefs] = await Promise.all([
      this.dataSource.getAccount(tenantId),
      this.dataSource.listInvoices(tenantId),
      this.dataSource.listInvoiceLines(tenantId),
      this.dataSource.listShoppingLists(tenantId),
      this.dataSource.listBudgets(tenantId),
      this.dataSource.listReceiptImageKeys(tenantId),
    ]);

    const entries: ArchiveEntry[] = [
      { name: 'account.json', bytes: toJsonBytes(account) },
      ...tableEntries('invoices', invoices),
      ...tableEntries('invoice_lines', invoiceLines),
      ...tableEntries('shopping_lists', shoppingLists),
      ...tableEntries('budgets', budgets),
      ...(await this.fetchImagesTolerantly(imageRefs)),
    ];

    const zip = await this.zipper.archive(entries);
    const s3Key = `${tenantId}/${requestId}.zip`;
    await this.exportsStorage.putObject(s3Key, zip, 'application/zip');
    await this.requests.markCompleted(requestId, s3Key);
    return { s3Key, email: account.email };
  }

  // Tolerates a receipt image already gone past the 18-month lifecycle rule — one missing
  // image must never fail the whole export (mirrors AdminDebugSampleService.buildSample).
  // Batched (not all-at-once) so a tenant with thousands of receipts doesn't hold thousands
  // of concurrent S3 connections/buffers at once.
  private async fetchImagesTolerantly(refs: ReceiptImageRef[]): Promise<ArchiveEntry[]> {
    const fetched = await fetchBytesTolerantly(
      refs,
      (ref) => ref.imageS3Key,
      (key) => this.uploadsStorage.getObjectBytes(key),
      IMAGE_FETCH_CONCURRENCY,
    );
    return fetched.map(({ ref, bytes }) => ({
      name: `receipts/${ref.invoiceId}.${attachmentFormatFromKey(ref.imageS3Key)}`,
      bytes,
    }));
  }
}

function tableEntries(name: string, rows: Record<string, unknown>[]): ArchiveEntry[] {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return [
    { name: `${name}.json`, bytes: toJsonBytes(rows) },
    { name: `${name}.csv`, bytes: new TextEncoder().encode(toCsv(headers, rows)) },
  ];
}

function toJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}
