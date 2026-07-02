export type DataRequestStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DataRequestRecord {
  id: string;
  tenantId: string;
  status: DataRequestStatus;
  exportS3Key: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface IDataRequestRepository {
  // Transaction-scoped advisory lock keyed on tenantId, held until COMMIT/ROLLBACK. Serializes
  // concurrent POST /me/export calls for the same tenant so the check-then-insert rate-limit
  // logic below can't race (two near-simultaneous requests both passing hasRecentExportRequest
  // before either commits its createExportRequest).
  acquireExportLock(tenantId: string): Promise<void>;
  // Only PENDING/PROCESSING/COMPLETED rows in the window count — a FAILED export must not
  // lock the tenant out of retrying the same day (§14 decision).
  hasRecentExportRequest(tenantId: string, sinceHours: number): Promise<boolean>;
  createExportRequest(tenantId: string): Promise<string>;
  // Atomically flips PENDING|FAILED -> PROCESSING, returning true only for the caller that wins
  // the claim. A redelivered SQS message arriving while the first invocation is already
  // PROCESSING (or the request is already COMPLETED) gets false and must no-op — this is what
  // makes ExportWorkerService.run() safe against concurrent/duplicate delivery. FAILED is a
  // claimable starting state too, so a retry after a crash (markFailed) can still succeed.
  claimForProcessing(id: string): Promise<boolean>;
  // RLS-scoped: a cross-tenant id resolves to null, never another tenant's row.
  getExportById(id: string): Promise<DataRequestRecord | null>;
  getLatestExport(tenantId: string): Promise<DataRequestRecord | null>;
  markCompleted(id: string, exportS3Key: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}
