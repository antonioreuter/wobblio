import type { SQSEvent, SQSBatchResponse } from 'aws-lambda';

// Skeleton agentic ingestion worker (Non-Functional 01 · 02). The Strands coordinator
// agent + tools land in 03; until dynamic routing (04) flips the feature flag the agentic
// queue receives no traffic, so this no-ops and reports no batch-item failures. It exists
// now so the standalone WobblioAgenticPipelineStack is deployable on its own.
export const handler = async (_event: SQSEvent): Promise<SQSBatchResponse> => {
  return { batchItemFailures: [] };
};
