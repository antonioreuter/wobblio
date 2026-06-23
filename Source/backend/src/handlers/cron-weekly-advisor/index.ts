import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { WeeklyAdvisorRepositoryAdapter } from '@infrastructure/adapters/ai/WeeklyAdvisorRepositoryAdapter';
import { WeeklyAdvisorService } from '@core/services/ai/WeeklyAdvisorService';
import { WEEKLY_ADVISOR_PROMPT, WEEKLY_ADVISOR_PROMPT_VERSION } from '../../prompts/weeklyAdvisor';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-weekly-advisor', context.awsRequestId);
  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
    30000,
  );

  // Haiku-class tier (cost): advisor uses the auxiliary model, not Sonnet insight.
  // See docs/amendments/2026-06-17-weekly-advisor-tier-and-concurrency.md. Resolved
  // via the canonical model registry (admin-console 03) — no hardcoded id.
  const auxiliaryModelId = await new SsmModelRegistryAdapter(REGION).getModelId('auxiliary');
  const service = new WeeklyAdvisorService(
    new WeeklyAdvisorRepositoryAdapter(pool),
    new BedrockConverseAdapter(REGION),
    auxiliaryModelId,
    WEEKLY_ADVISOR_PROMPT,
    WEEKLY_ADVISOR_PROMPT_VERSION,
  );

  const today = new Date().toISOString().slice(0, 10);
  const { eligible, generated } = await service.run(today);
  log.info('weekly advisor complete', { eligible, generated });
};
