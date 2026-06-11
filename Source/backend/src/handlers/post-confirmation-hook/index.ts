import type { PostConfirmationTriggerEvent, Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/AppUserRepositoryAdapter';
import { FreeUserCounterAdapter } from '@infrastructure/adapters/FreeUserCounterAdapter';
import { SsmWaitlistCapAdapter } from '@infrastructure/adapters/SsmWaitlistCapAdapter';
import { UserProvisioningService } from '@core/services/UserProvisioningService';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

export const handler = async (
  event: PostConfirmationTriggerEvent,
  context: Context,
): Promise<PostConfirmationTriggerEvent> => {
  const log = createLambdaLogger('post-confirmation-hook', context.awsRequestId);

  try {
    const cognitoSub = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;

    if (!cognitoSub || !email) {
      log.warn('post-confirmation missing required attributes', { cognitoSub, hasEmail: !!email });
      return event;
    }

    const pool = await buildPool(
      process.env.DB_SECRET_ARN!,
      process.env.DB_HOST!,
      process.env.DB_PORT!,
    );

    const service = new UserProvisioningService(
      new AppUserRepositoryAdapter(pool),
      new FreeUserCounterAdapter(pool),
      new SsmWaitlistCapAdapter(REGION),
    );

    const { status } = await service.provisionUser(cognitoSub, email);
    log.info('user provisioned', { cognitoSub, status });
  } catch (err) {
    // Log but never throw — throwing here prevents account confirmation
    log.error('post-confirmation-hook non-fatal error', { err });
  }

  return event;
};
