import type { PreSignUpTriggerEvent, Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';

export const handler = async (
  event: PreSignUpTriggerEvent,
  context: Context,
): Promise<PreSignUpTriggerEvent> => {
  const log = createLambdaLogger('pre-signup-hook', context.awsRequestId);
  log.info('pre-signup trigger fired', { userPoolId: event.userPoolId });
  return event;
};
