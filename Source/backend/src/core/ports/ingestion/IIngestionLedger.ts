export interface IIngestionLedger {
  // INSERT ... ON CONFLICT DO NOTHING — returns true only on the first delivery
  // for this s3_key (transport idempotency). false => duplicate delivery.
  claim(s3Key: string, tenantId: string): Promise<boolean>;
  setStatus(s3Key: string, status: string): Promise<void>;
  // Drops the ledger entry so the same content-addressed s3_key can be re-claimed
  // after the invoice is deleted (otherwise a re-upload short-circuits as a stale
  // duplicate delivery and never leaves PROCESSING). Idempotent.
  release(s3Key: string): Promise<void>;
}
