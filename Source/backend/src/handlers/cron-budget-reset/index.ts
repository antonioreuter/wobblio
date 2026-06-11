import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';

export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-budget-reset', context.awsRequestId);
  log.info('budget reset cron triggered');
};
