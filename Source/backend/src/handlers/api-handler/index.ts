import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/AppUserRepositoryAdapter';
import { TenantContextAdapter } from '@infrastructure/adapters/TenantContextAdapter';
import { WaitlistRepositoryAdapter } from '@infrastructure/adapters/WaitlistRepositoryAdapter';

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

    if (user.status === 'WAITLIST') {
      const total = await waitlistRepo.getWaitlistCount();
      log.info('waitlisted user access attempt', { userId: user.id, total });
      return json(423, {
        position: total,
        total_waitlist: total,
        upgrade_url: 'https://app.wobblio.nl/billing',
      });
    }

    await tenantCtx.setTenantId(user.id);
    log.info('request authorised', { userId: user.id, role: user.role });

    // Route dispatch — real routes added in later epics
    return json(200, { status: 'ok' });
  } finally {
    client.release();
  }
};
