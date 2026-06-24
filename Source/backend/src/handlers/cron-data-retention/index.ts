import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { DataRetentionRepositoryAdapter } from '@infrastructure/adapters/maintenance/DataRetentionRepositoryAdapter';
import { DataRetentionService } from '@core/services/maintenance/DataRetentionService';

export const handler = async (
  event: { resource: string },
  context: Context,
): Promise<void> => {
  const log = createLambdaLogger('cron-data-retention', context.awsRequestId);
  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
    30000,
  );

  const service = new DataRetentionService(
    new DataRetentionRepositoryAdapter(pool),
  );

  const outcome = await service.purge(event.resource);
  log.info('data retention complete', { resource: outcome.resource, deleted: outcome.deleted });
};
