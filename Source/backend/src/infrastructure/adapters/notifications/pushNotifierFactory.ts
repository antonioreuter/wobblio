import type { PoolClient } from 'pg';
import type { IPushNotifier } from '@core/ports/notifications/IPushNotifier';
import { MockPushAdapter } from './MockPushAdapter';
import { SnsPushNotifierAdapter } from './SnsPushNotifierAdapter';

// Local has no SNS/SSM, so pushes stay logged mocks. Deployed stages deliver via SNS —
// best-effort: an unconfigured platform ARN simply means no delivery, never an error. The
// SNS adapter reuses the caller's (post-COMMIT idle) client rather than borrowing a second
// connection, since the deployed worker pool is max:1.
export function buildPushNotifier(client: PoolClient): IPushNotifier {
  if (process.env.STAGE === 'local') return new MockPushAdapter();
  const region = process.env.AWS_REGION ?? 'eu-west-1';
  const stage = process.env.STAGE ?? 'dev';
  return new SnsPushNotifierAdapter(client, region, stage);
}
