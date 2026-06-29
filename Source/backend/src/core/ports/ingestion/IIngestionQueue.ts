export interface IngestionMessage {
  invoiceId: string;
  tenantId: string;
  s3Key: string;
  // Set by an operator reprocess-on-behalf re-enqueue (§07). On success the worker fires an
  // `invoice_reprocessed` notification and, if the charge week differs from the invoice's
  // original week, emits the `reprocess cross week` KPI log. Absent for normal uploads.
  reprocess?: boolean;
}

export interface IIngestionQueue {
  enqueue(message: IngestionMessage): Promise<void>;
}
