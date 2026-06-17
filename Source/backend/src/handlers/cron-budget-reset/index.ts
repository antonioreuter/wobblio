import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { BudgetRecyclerRepositoryAdapter } from '@infrastructure/adapters/budgets/BudgetRecyclerRepositoryAdapter';
import { NotificationRepositoryAdapter } from '@infrastructure/adapters/notifications/NotificationRepositoryAdapter';
import { MockPushAdapter } from '@infrastructure/adapters/notifications/MockPushAdapter';
import { BudgetRecyclerService } from '@core/services/budgets/BudgetRecyclerService';

// Nightly EventBridge cron (§10): recompute budget accumulation, fire 85%/100%
// alerts, roll periods over, and purge expired notifications.
export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-budget-reset', context.awsRequestId);
  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
    30000,
  );

  const service = new BudgetRecyclerService(
    new BudgetRecyclerRepositoryAdapter(pool),
    new NotificationRepositoryAdapter(pool),
    new MockPushAdapter(),
  );

  const today = new Date().toISOString().slice(0, 10);
  const { processed, alertsFired } = await service.run(today);
  log.info('budget recycler complete', { processed, alertsFired });
};
