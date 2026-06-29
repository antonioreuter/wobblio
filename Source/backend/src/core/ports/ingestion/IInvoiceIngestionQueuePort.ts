// Confirm-time pipeline routing seam: the API enqueues an invoice without knowing whether it
// lands on the legacy or agentic queue (the adapter decides from the SSM feature flag). Kept
// separate from IIngestionQueue (which still carries the operator reprocess flag) per the
// epic's locked decision #1.
export interface IInvoiceIngestionQueuePort {
  enqueue(invoiceId: string, tenantId: string, s3Key: string): Promise<void>;
}
