import type { PreSignUpTriggerEvent, Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { FreeUserCounterAdapter } from '@infrastructure/adapters/FreeUserCounterAdapter';
import { SsmWaitlistCapAdapter } from '@infrastructure/adapters/SsmWaitlistCapAdapter';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

export const handler = async (
  event: PreSignUpTriggerEvent,
  context: Context,
): Promise<PreSignUpTriggerEvent> => {
  const log = createLambdaLogger('pre-signup-hook', context.awsRequestId);

  try {
    const pool = await buildPool(
      process.env.DB_SECRET_ARN!,
      process.env.DB_HOST!,
      process.env.DB_PORT!,
    );

    const capProvider = new SsmWaitlistCapAdapter(REGION);
    const counter = new FreeUserCounterAdapter(pool);

    const [cap, currentCount] = await Promise.all([
      capProvider.getMaxFreeUsersCap(),
      counter.getCurrentCount(),
    ]);

    const willBeWaitlisted = currentCount >= cap;
    log.info('pre-signup evaluated', {
      cognitoSub: event.request.userAttributes.sub,
      currentCount,
      cap,
      willBeWaitlisted,
    });
  } catch (err) {
    // Log but never throw — throwing here would block the Cognito signup
    log.error('pre-signup-hook non-fatal error', { err });
  }

  return event;
};
