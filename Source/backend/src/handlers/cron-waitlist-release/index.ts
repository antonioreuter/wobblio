import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { FreeUserCounterAdapter } from '@infrastructure/adapters/waitlist/FreeUserCounterAdapter';
import { SsmWaitlistCapAdapter } from '@infrastructure/adapters/waitlist/SsmWaitlistCapAdapter';
import { WaitlistRepositoryAdapter } from '@infrastructure/adapters/waitlist/WaitlistRepositoryAdapter';
import { SesEmailAdapter } from '@infrastructure/adapters/notifications/SesEmailAdapter';
import { WaitlistReleaseService } from '@core/services/waitlist/WaitlistReleaseService';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-waitlist-release', context.awsRequestId);

  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
    30000,
  );

  const service = new WaitlistReleaseService(
    new FreeUserCounterAdapter(pool),
    new SsmWaitlistCapAdapter(REGION),
    new WaitlistRepositoryAdapter(pool),
    new SesEmailAdapter(REGION, process.env.SES_FROM_ADDRESS ?? 'noreply@wobblio.nl'),
  );

  const { released } = await service.releaseEligibleUsers();
  log.info('waitlist release complete', { released });
};
