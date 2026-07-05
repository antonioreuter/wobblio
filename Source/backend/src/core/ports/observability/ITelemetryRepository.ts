// Per-invoice ingestion telemetry write (non-functional 01). Written by the worker inside
// its unified tenant transaction so it commits atomically with the invoice rows and is
// covered by RLS.
export interface InvoiceTelemetryRecord {
  tenantId: string;
  invoiceId: string;
  processingMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  status: string;
}

export interface ITelemetryRepository {
  recordInvoiceTelemetry(record: InvoiceTelemetryRecord): Promise<void>;
}
