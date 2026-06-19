import type { Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { WeeklyAdvisorRepositoryAdapter } from '@infrastructure/adapters/ai/WeeklyAdvisorRepositoryAdapter';
import { WeeklyAdvisorService } from '@core/services/ai/WeeklyAdvisorService';
import { WEEKLY_ADVISOR_PROMPT, WEEKLY_ADVISOR_PROMPT_VERSION } from '../../prompts/weeklyAdvisor';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
// Haiku-class tier (cost): advisor moved off the Sonnet insight model. See
// docs/amendments/2026-06-17-weekly-advisor-tier-and-concurrency.md.
const AUXILIARY_MODEL_PARAM = '/wobblio/config/models/auxiliary';

async function resolveAuxiliaryModel(): Promise<string> {
  const ssm = new SSMClient({ region: REGION });
  const response = await ssm.send(new GetParameterCommand({ Name: AUXILIARY_MODEL_PARAM }));
  const value = response.Parameter?.Value ?? '';
  if (!value) throw new Error(`SSM parameter ${AUXILIARY_MODEL_PARAM} is missing`);
  return value;
}

export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-weekly-advisor', context.awsRequestId);
  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
    30000,
  );

  const service = new WeeklyAdvisorService(
    new WeeklyAdvisorRepositoryAdapter(pool),
    new BedrockConverseAdapter(REGION),
    await resolveAuxiliaryModel(),
    WEEKLY_ADVISOR_PROMPT,
    WEEKLY_ADVISOR_PROMPT_VERSION,
  );

  const today = new Date().toISOString().slice(0, 10);
  const { eligible, generated } = await service.run(today);
  log.info('weekly advisor complete', { eligible, generated });
};
