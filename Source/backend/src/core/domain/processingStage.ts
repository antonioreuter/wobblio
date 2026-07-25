// The coarse, user-visible pipeline stages of an in-flight ingestion (fix 07/01). Deliberately
// only four: classification and tag generation are ~0ms deterministic paths, so per-tool
// granularity would render as flicker, not information.
//
// Distinct from AgenticStage (which answers "which component failed" for operators) — this is
// the customer-facing progress model, and the client copy is keyed off these exact labels.
export type ProcessingStage = 'RECEIVED' | 'READING' | 'MATCHING' | 'FINALIZING';

// The stage an invoice is implicitly in before the worker writes anything: enqueued, waiting for
// a consumer. Stored nowhere — the read path substitutes it for a PROCESSING invoice with no
// progress row, which keeps the presign/confirm path free of an extra write.
export const INITIAL_PROCESSING_STAGE: ProcessingStage = 'RECEIVED';
