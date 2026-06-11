import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLambdaLogger, type LambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/AppUserRepositoryAdapter';
import { TenantContextAdapter } from '@infrastructure/adapters/TenantContextAdapter';
import { WaitlistRepositoryAdapter } from '@infrastructure/adapters/WaitlistRepositoryAdapter';
import { MockBillingGatewayAdapter } from '@infrastructure/adapters/MockBillingGatewayAdapter';
import { SsmBillingWhitelistAdapter } from '@infrastructure/adapters/SsmBillingWhitelistAdapter';
import { PaymentTransactionRepositoryAdapter } from '@infrastructure/adapters/PaymentTransactionRepositoryAdapter';
import { S3BillingArchiveAdapter } from '@infrastructure/adapters/S3BillingArchiveAdapter';
import { BillingService } from '@core/services/BillingService';
import { InvalidBillingPlanError } from '@core/domain/errors';
import type { AppUser } from '@core/ports/IAppUserRepository';
import type { Pool } from 'pg';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const json = (statusCode: number, body: object): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLambdaLogger('api-handler', context.awsRequestId);

  const cognitoSub = (event.requestContext as any).authorizer?.claims?.sub as string | undefined;
  if (!cognitoSub) {
    log.warn('request missing cognito sub');
    return json(401, { message: 'Unauthorized' });
  }

  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
  );

  const client = await pool.connect();
  try {
    const userRepo = new AppUserRepositoryAdapter(pool);
    const tenantCtx = new TenantContextAdapter(client);
    const waitlistRepo = new WaitlistRepositoryAdapter(pool);

    const user = await userRepo.findByCognitoSub(cognitoSub);
    if (!user) {
      log.warn('user not found in app_user', { cognitoSub });
      return json(401, { message: 'Unauthorized' });
    }

    if (user.status === 'DELETED') {
      log.info('deleted account attempted access', { userId: user.id });
      return json(403, { message: 'Forbidden' });
    }

    const path = event.path ?? '';
    const method = event.httpMethod ?? 'GET';
    const isBillingRoute = path.startsWith('/billing/');

    if (user.status === 'WAITLIST' && !isBillingRoute) {
      const total = await waitlistRepo.getWaitlistCount();
      log.info('waitlisted user access attempt', { userId: user.id, total });
      return json(423, {
        position: total,
        total_waitlist: total,
        upgrade_url: 'https://app.wobblio.nl/billing',
      });
    }

    await tenantCtx.setTenantId(user.id);
    log.info('request authorised', { userId: user.id, role: user.role, path, method });

    if (isBillingRoute) {
      return handleBillingRoute(pool, user, path, method, event, log);
    }

    return json(200, { status: 'ok' });
  } finally {
    client.release();
  }
};

async function handleBillingRoute(
  pool: Pool,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (method !== 'POST') {
    return json(405, { message: 'Method Not Allowed' });
  }

  if (path === '/billing/checkout-session') {
    return handleCheckoutSession(pool, user, event, log);
  }

  if (path === '/billing/portal-session') {
    if (user.role !== 'PREMIUM') {
      return json(403, { message: 'Forbidden' });
    }
    return json(200, { portalUrl: `mock://portal/${user.id}` });
  }

  return json(404, { message: 'Not Found' });
}

async function handleCheckoutSession(
  pool: Pool,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const plan = typeof body.plan === 'string' ? body.plan : '';

  const webAppUrl = process.env.WEB_APP_URL!;
  const archiveBucket = process.env.BILLING_ARCHIVE_BUCKET!;

  const service = new BillingService(
    new MockBillingGatewayAdapter(),
    new SsmBillingWhitelistAdapter(REGION),
    new PaymentTransactionRepositoryAdapter(pool),
    new S3BillingArchiveAdapter(REGION, archiveBucket),
    new AppUserRepositoryAdapter(pool),
    {
      successUrl: `${webAppUrl}/upgrade/success`,
      cancelUrl: `${webAppUrl}/upgrade/cancel?reason=not_whitelisted`,
    },
  );

  try {
    const result = await service.createCheckoutSession(
      { id: user.id, email: user.email },
      plan,
    );
    if (result.status === 'CANCELED') {
      log.info('mock_checkout_rejected', { userId: user.id, email: user.email });
    } else {
      log.info('mock_checkout_completed', { userId: user.id, plan });
    }
    return json(200, result);
  } catch (err) {
    if (err instanceof InvalidBillingPlanError) {
      return json(400, { message: err.message });
    }
    throw err;
  }
}

function parseJsonBody(body: string | null): Record<string, unknown> {
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}
