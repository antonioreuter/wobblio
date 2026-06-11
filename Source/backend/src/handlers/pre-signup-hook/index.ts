import type { PreSignUpTriggerEvent } from 'aws-lambda';

export const handler = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> =>
  event;
