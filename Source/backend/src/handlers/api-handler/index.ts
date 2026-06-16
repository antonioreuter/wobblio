import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLambdaLogger, type LambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/identity/AppUserRepositoryAdapter';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { WaitlistRepositoryAdapter } from '@infrastructure/adapters/waitlist/WaitlistRepositoryAdapter';
import { MockBillingGatewayAdapter } from '@infrastructure/adapters/billing/MockBillingGatewayAdapter';
import { SsmBillingWhitelistAdapter } from '@infrastructure/adapters/billing/SsmBillingWhitelistAdapter';
import { PaymentTransactionRepositoryAdapter } from '@infrastructure/adapters/billing/PaymentTransactionRepositoryAdapter';
import { S3BillingArchiveAdapter } from '@infrastructure/adapters/billing/S3BillingArchiveAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';
import { QuotaRepositoryAdapter } from '@infrastructure/adapters/quota/QuotaRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { SqsIngestionQueueAdapter } from '@infrastructure/adapters/ingestion/SqsIngestionQueueAdapter';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { BillingService } from '@core/services/billing/BillingService';
import { ProfileService } from '@core/services/identity/ProfileService';
import { QuotaService } from '@core/services/quota/QuotaService';
import { PresignService } from '@core/services/ingestion/PresignService';
import { ConfirmService } from '@core/services/ingestion/ConfirmService';
import {
  InvalidBillingPlanError,
  InvalidProfileError,
  DuplicateInvoiceError,
  QuotaExceededError,
  InvoiceNotFoundError,
  StaleUploadError,
} from '@core/domain/errors';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
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
    const isInvoicesRoute = path.startsWith('/invoices');
    const isReferenceRoute = path.startsWith('/reference/');

    // Billing (upgrade), own-profile onboarding, and reference lookups stay
    // reachable while waitlisted; everything else is gated until a slot is released.
    if (user.status === 'WAITLIST' && !isBillingRoute && !isMeRoute && !isReferenceRoute) {
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

    if (isInvoicesRoute) {
      return handleInvoicesRoute(client, user, path, method, event, log);
    }

    if (isReferenceRoute) {
      return handleReferenceRoute(client, path, method, event);
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
  if (path === '/me/usage' && method === 'GET') return handleUsage(db, user);

  if (path !== '/me/profile') {
    return json(404, { message: 'Not Found' });
  }

  const service = new ProfileService(new AppUserRepositoryAdapter(db), new RegionReferenceAdapter(db));

  if (method === 'GET') {
    return json(200, await service.getProfile(user.cognitoSub));
  }

  if (method === 'PUT') {
    const body = parseJsonBody(event.body);
    try {
      await service.completeOnboarding(user.cognitoSub, {
        fullName: String(body.fullName ?? ''),
        country: String(body.country ?? ''),
        regionCode: String(body.regionCode ?? ''),
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

// Reference data for the onboarding region dropdown. Country comes from the
// query string; subdivisions are the ISO 3166-2 list for that country.
async function handleReferenceRoute(
  db: PoolClient,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (path !== '/reference/regions' || method !== 'GET') return json(404, { message: 'Not Found' });
  const country = (event.queryStringParameters?.country ?? '').toUpperCase();
  if (country.length !== 2) return json(400, { message: 'country query parameter is required' });
  const subdivisions = await new RegionReferenceAdapter(db).listSubdivisions(country);
  return json(200, { subdivisions });
}

async function handleUsage(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  const cap = await new SsmUploadQuotaAdapter(REGION).getPersonalUploadsCap(user.role);
  const quotaService = new QuotaService(new QuotaRepositoryAdapter(db));
  const used = await withTenantTx(db, user.id, () =>
    quotaService.getUsed(user.id, 'UPLOADS', new Date()),
  );
  return json(200, { used, cap, remaining: Math.max(0, cap - used) });
}

const SHA256_RE = /^[a-f0-9]{64}$/i;

async function withTenantTx<T>(db: PoolClient, tenantId: string, fn: () => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  try {
    await new TenantContextAdapter(db).setTenantId(tenantId);
    const result = await fn();
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

async function handleInvoicesRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && path === '/invoices') return handleListInvoices(db, user);

  const confirmMatch = path.match(/^\/invoices\/([^/]+)\/confirm$/);
  if (method === 'POST' && confirmMatch) return handleConfirm(db, user, confirmMatch[1], log);

  if (method === 'POST' && path === '/invoices/presign') return handlePresign(db, user, event, log);

  const detailMatch = path.match(/^\/invoices\/([^/]+)$/);
  if (method === 'GET' && detailMatch) return handleInvoiceDetail(db, user, detailMatch[1]);

  return json(404, { message: 'Not Found' });
}

async function handleListInvoices(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  const invoices = await withTenantTx(db, user.id, () =>
    new InvoiceRepositoryAdapter(db).listForTenant(100),
  );
  return json(200, { invoices });
}

async function handleInvoiceDetail(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
): Promise<APIGatewayProxyResult> {
  const detail = await withTenantTx(db, user.id, () =>
    new InvoiceRepositoryAdapter(db).getDetail(invoiceId),
  );
  if (!detail) return json(404, { message: 'Invoice not found' });

  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const { imageS3Key, ...rest } = detail;
  const imageUrl = await new S3FileStorageAdapter(REGION, uploadsBucket).presignGet(imageS3Key, 300);
  return json(200, { ...rest, imageUrl });
}

async function handlePresign(
  db: PoolClient,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const imageSha256 = typeof body.imageSha256 === 'string' ? body.imageSha256 : '';
  if (!SHA256_RE.test(imageSha256)) {
    return json(400, { message: 'imageSha256 must be a 64-character hex string' });
  }
  const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/jpeg';
  const householdId = typeof body.householdId === 'string' ? body.householdId : null;

  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const service = new PresignService(
    new InvoiceRepositoryAdapter(db),
    new QuotaService(new QuotaRepositoryAdapter(db)),
    new SsmUploadQuotaAdapter(REGION),
    new S3FileStorageAdapter(REGION, uploadsBucket),
  );

  try {
    const result = await withTenantTx(db, user.id, () =>
      service.presign({
        tenantId: user.id,
        uploadedByUserId: user.id,
        role: user.role,
        householdId,
        imageSha256,
        contentType,
      }),
    );
    log.info('presign issued', { userId: user.id, invoiceId: result.invoiceId });
    return json(201, result);
  } catch (err) {
    if (err instanceof DuplicateInvoiceError) return json(409, { message: 'Receipt already scanned' });
    if (err instanceof QuotaExceededError) {
      return json(429, { message: 'Upload quota exceeded', used: err.used, cap: err.cap });
    }
    throw err;
  }
}

async function handleConfirm(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const queueUrl = process.env.INGEST_QUEUE_URL!;
  const service = new ConfirmService(
    new InvoiceRepositoryAdapter(db),
    new S3FileStorageAdapter(REGION, uploadsBucket),
    new SqsIngestionQueueAdapter(REGION, queueUrl),
  );

  try {
    await withTenantTx(db, user.id, () => service.confirm(invoiceId, user.id));
    log.info('ingestion enqueued', { userId: user.id, invoiceId });
    return json(202, { status: 'accepted', invoiceId });
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return json(404, { message: 'Invoice not found' });
    if (err instanceof StaleUploadError) return json(410, { message: 'Upload missing or expired; re-initiate presign' });
    throw err;
  }
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
