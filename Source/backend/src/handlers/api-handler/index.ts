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
import { ProfileService } from '@core/services/ProfileService';
import { InvalidBillingPlanError, InvalidProfileError } from '@core/domain/errors';
import type { AppUser } from '@core/ports/IAppUserRepository';
import type { PoolClient } from 'pg';

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
    // Every query runs on the single acquired `client` so the request uses one
    // connection (max:1) and shares the RLS tenant context set below.
    const userRepo = new AppUserRepositoryAdapter(client);
    const tenantCtx = new TenantContextAdapter(client);
    const waitlistRepo = new WaitlistRepositoryAdapter(client);

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
    const isMeRoute = path.startsWith('/me/');

    // Billing (upgrade) and own-profile onboarding stay reachable while
    // waitlisted; everything else is gated until a slot is released.
    if (user.status === 'WAITLIST' && !isBillingRoute && !isMeRoute) {
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
      return handleBillingRoute(client, user, path, method, event, log);
    }

    if (isMeRoute) {
      return handleMeRoute(client, user, path, method, event, log);
    }

    return json(200, { status: 'ok' });
  } finally {
    client.release();
  }
};

async function handleMeRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (path !== '/me/profile') {
    return json(404, { message: 'Not Found' });
  }

  const service = new ProfileService(new AppUserRepositoryAdapter(db));

  if (method === 'GET') {
    return json(200, await service.getProfile(user.cognitoSub));
  }

  if (method === 'PUT') {
    const body = parseJsonBody(event.body);
    try {
      await service.completeOnboarding(user.cognitoSub, {
        fullName: String(body.fullName ?? ''),
        country: String(body.country ?? ''),
        language: String(body.language ?? ''),
        currency: String(body.currency ?? ''),
        birthdate: String(body.birthdate ?? ''),
        consent: body.consent === true,
      });
      log.info('onboarding completed', { userId: user.id });
      return json(200, { onboarded: true });
    } catch (err) {
      if (err instanceof InvalidProfileError) {
        return json(400, { message: err.message });
      }
      throw err;
    }
  }

  return json(405, { message: 'Method Not Allowed' });
}

async function handleBillingRoute(
  db: PoolClient,
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
    return handleCheckoutSession(db, user, event, log);
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
  db: PoolClient,
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
    new PaymentTransactionRepositoryAdapter(db),
    new S3BillingArchiveAdapter(REGION, archiveBucket),
    new AppUserRepositoryAdapter(db),
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
