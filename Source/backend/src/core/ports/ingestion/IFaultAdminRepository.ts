import type { FailureReasonCode } from '../../domain/failureReasons';

// Metadata-only view of a system-fault-quarantined invoice (§07.1) — never invoice content
// (Locked decision #1). system_fault_reason is our internal root cause, shown to operators.
export interface BlockedInvoice {
  invoiceId: string;
  ownerId: string;
  systemFaultReason: string;
  imageS3Key: string;
  blockedAt: string;
}

// The tenant + stored key a reprocess returns so the caller can re-enqueue the file.
export interface ReprocessTarget {
  tenantId: string;
  s3Key: string;
}

// Cross-tenant operator actions on quarantined invoices, backed by SECURITY DEFINER
// functions (the admin connection's RLS scope can't reach other tenants' invoices).
export interface IFaultAdminRepository {
  listBlocked(): Promise<BlockedInvoice[]>;
  // Releases the ledger claim + flips the invoice back to PROCESSING + clears the
  // quarantine, atomically. Null when the invoice is no longer quarantined (caller skips
  // the re-enqueue).
  reprocess(invoiceId: string): Promise<ReprocessTarget | null>;
  // Demotes a quarantined invoice to a deletable user-fault (keeps FAILED_PROCESSING +
  // sets the reason code). Returns the tenant id (for an optional notification), or null
  // when it wasn't quarantined.
  wontProcess(invoiceId: string, reasonCode: FailureReasonCode): Promise<{ tenantId: string } | null>;
}
