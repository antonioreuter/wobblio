import type { SQSEvent, SQSBatchResponse } from 'aws-lambda';

export const handler = async (_event: SQSEvent): Promise<SQSBatchResponse> => ({
  batchItemFailures: [],
});
