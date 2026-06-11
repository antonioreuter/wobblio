import type { SQSEvent, SQSBatchResponse, Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';

export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('ingestion-worker', context.awsRequestId);
  log.info('batch received', { count: event.Records.length });
  return { batchItemFailures: [] };
};
