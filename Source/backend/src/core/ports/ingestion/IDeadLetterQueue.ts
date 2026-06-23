// Operator triage of failed ingestions sitting in the dead-letter queue.
// receiptHandle is the SQS handle the panel echoes back for a single-message
// replay/delete (it expires, so the panel passes the one from its last list()).
export interface DlqMessage {
  messageId: string;
  receiptHandle: string;
  body: string;
  preview: string; // body truncated for the list row
  tenantId: string | null; // parsed from the ingestion message where present
  invoiceId: string | null;
  s3Key: string | null;
  approximateReceiveCount: number;
  firstFailedAt: string | null; // ISO; derived from the SentTimestamp attribute
}

export interface IDeadLetterQueue {
  list(limit: number): Promise<DlqMessage[]>;
  get(messageId: string): Promise<DlqMessage | null>;
  // Send `body` back to the main ingestion queue, then delete the DLQ copy by handle.
  // The panel echoes messageId/receiptHandle/body from its last list(). Returns false
  // if the handle is stale / message no longer present.
  replay(messageId: string, receiptHandle: string, body: string): Promise<boolean>;
  remove(messageId: string, receiptHandle: string): Promise<boolean>;
  // Bulk variants receive-and-act in one shot (no cross-call handle expiry),
  // bounded by limit. Return the affected count.
  replayAll(limit: number): Promise<number>;
  deleteAll(limit: number): Promise<number>;
}
