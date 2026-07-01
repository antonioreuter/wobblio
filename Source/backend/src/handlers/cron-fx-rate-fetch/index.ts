import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { EcbRateSourceAdapter } from '@infrastructure/adapters/fx/EcbRateSourceAdapter';
import { FxRateRepositoryAdapter } from '@infrastructure/adapters/fx/FxRateRepositoryAdapter';
import { FetchDailyFxRatesService } from '@core/services/fx/FetchDailyFxRatesService';

// Daily ECB reference-rate fetch (§11 FX). fx_rate is a global RLS-exempt table, so no tenant
// context. On exhausted retries the service reports a fallback (yesterday's rates stand in); the
// error log line `fx_fetch_fallback` backs the CloudWatch alarm.
export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-fx-rate-fetch', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!, 30000);

  const client = await pool.connect();
  try {
    const service = new FetchDailyFxRatesService(
      new EcbRateSourceAdapter(),
      new FxRateRepositoryAdapter(client),
    );
    const result = await service.run();

    if (result.usedFallback) {
      log.error('fx_fetch_fallback', { reason: 'ECB fetch failed after retries; using stored rates' });
      return;
    }
    log.info('fx rate fetch complete', { upserted: result.upserted });
  } finally {
    client.release();
  }
};
