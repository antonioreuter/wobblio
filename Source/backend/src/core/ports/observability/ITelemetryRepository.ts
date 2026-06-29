// Per-invoice ingestion telemetry write (non-functional 01). Written by the worker inside
// its unified tenant transaction so it commits atomically with the invoice rows and is
// covered by RLS. pipelineType distinguishes the legacy worker from the Strands worker (03).
export interface InvoiceTelemetryRecord {
  tenantId: string;
  invoiceId: string;
  pipelineType: 'LEGACY' | 'STRANDS';
  processingMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  status: string;
}

export interface ITelemetryRepository {
  recordInvoiceTelemetry(record: InvoiceTelemetryRecord): Promise<void>;
}
