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
import { HouseholdRepositoryAdapter } from '@infrastructure/adapters/households/HouseholdRepositoryAdapter';
import { InvoiceShareRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceShareRepositoryAdapter';
import { InvoiceFeedbackRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceFeedbackRepositoryAdapter';
import { SecureTokenAdapter } from '@infrastructure/adapters/security/SecureTokenAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';
import { AwsLocationReverseGeocoderAdapter } from '@infrastructure/adapters/data-intelligence/AwsLocationReverseGeocoderAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { QuotaRepositoryAdapter } from '@infrastructure/adapters/quota/QuotaRepositoryAdapter';
import { WeeklyAdvisorRepositoryAdapter } from '@infrastructure/adapters/ai/WeeklyAdvisorRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { SqsInvoiceIngestionQueueAdapter } from '@infrastructure/adapters/ingestion/SqsInvoiceIngestionQueueAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import { BillingService } from '@core/services/billing/BillingService';
import { ProfileService } from '@core/services/identity/ProfileService';
import { QuotaService } from '@core/services/quota/QuotaService';
import { UploadAllowanceResolver } from '@core/services/quota/UploadAllowanceResolver';
import { PresignService } from '@core/services/ingestion/PresignService';
import { ConfirmService } from '@core/services/ingestion/ConfirmService';
import { DeleteInvoiceService } from '@core/services/ingestion/DeleteInvoiceService';
import { ShareInvoiceService } from '@core/services/ingestion/ShareInvoiceService';
import { InvoiceLocationService } from '@core/services/ingestion/InvoiceLocationService';
import { RecordFeedbackService } from '@core/services/ingestion/RecordFeedbackService';
import { CorrectInvoiceService } from '@core/services/ingestion/CorrectInvoiceService';
import type { CorrectInvoiceInput, CorrectInvoiceLine } from '@core/ports/ingestion/IInvoiceRepository';
import {
  InvalidBillingPlanError,
  InvalidProfileError,
  DuplicateInvoiceError,
  QuotaExceededError,
  InvoiceNotFoundError,
  InvoiceNotDeletableError,
  InvoiceNotCorrectableError,
  InvalidCorrectionError,
  InvoiceBlockedError,
  StaleUploadError,
  LocationAlreadySetError,
  LocationNotConfirmableError,
  InvalidLocationError,
  InvalidFeedbackError,
  PremiumRequiredError,
  UnsupportedUploadTypeError,
} from '@core/domain/errors';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { CATEGORY_TAXONOMY } from '@core/domain/categoryTaxonomy';
import type { PoolClient } from 'pg';
import { REGION, json, parseJsonBody, withTenantTx, uploadQuotaAdapter } from './shared';
import { handleHouseholdsRoute } from './householdRoutes';
import { handleBudgetsRoute } from './budgetRoutes';
import { handleNotificationsRoute } from './notificationRoutes';
import { handleListsRoute } from './listRoutes';
import { handleProductsRoute } from './productRoutes';
import { handlePriceTrendsRoute } from './priceTrendRoutes';
import { handleAdminRoute } from './adminRoutes';

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
    // A missing user, or one that resolved without a tenant id, must never reach a
    // route: an empty id would set an empty RLS tenant context and surface as an
    // opaque uuid cast error (22P02) on the first query of any route.
    if (!user || !user.id) {
      log.warn('user not resolved to a tenant', { cognitoSub, hasUser: !!user });
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
    const isHouseholdsRoute = path.startsWith('/households');
    const isBudgetsRoute = path.startsWith('/budgets');
    const isNotificationsRoute = path.startsWith('/notifications');
    const isListsRoute = path.startsWith('/lists');
    const isProductsRoute = path.startsWith('/products');
    const isPriceTrendsRoute = path.startsWith('/price-trends');
    const isAdminRoute = path.startsWith('/admin/');

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

    if (isHouseholdsRoute) {
      return handleHouseholdsRoute(client, user, path, method, event, log);
    }

    if (isBudgetsRoute) {
      return handleBudgetsRoute(client, user, path, method, event, log);
    }

    if (isNotificationsRoute) {
      return handleNotificationsRoute(client, user, path, method);
    }

    if (isListsRoute) {
      return handleListsRoute(client, user, path, method, event, log);
    }

    if (isProductsRoute) {
      return handleProductsRoute(client, user, path, method, event);
    }

    if (isPriceTrendsRoute) {
      return handlePriceTrendsRoute(client, user, path, method, event);
    }

    if (isAdminRoute) {
      return handleAdminRoute(client, user, path, method, event, log);
    }

    return json(200, { status: 'ok' });
  } catch (err) {
    // Sub-handlers map their own domain errors; anything reaching here is an
    // unexpected fault (missing SSM config, DB blip, …). Without this catch it
    // leaks as an opaque 500 with no log — surface it as a structured error.
    log.error('unhandled api-handler error', {
      path: event.path,
      method: event.httpMethod,
      err: err instanceof Error ? err : new Error(String(err)),
    });
    return json(500, { message: 'Internal Server Error' });
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
  if (path === '/me/advisor' && method === 'GET') return handleAdvisorCard(db, user);
  if (path === '/me/stats/top-merchant' && method === 'GET') return handleTopMerchant(db, user);

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

// Reference data for onboarding and budget configuration. Regions are the
// ISO 3166-2 list for a query-string country; categories are the static spend
// taxonomy used to scope CATEGORY budgets.
async function handleReferenceRoute(
  db: PoolClient,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method !== 'GET') return json(404, { message: 'Not Found' });

  if (path === '/reference/categories') {
    return json(200, { categories: CATEGORY_TAXONOMY });
  }

  if (path !== '/reference/regions') return json(404, { message: 'Not Found' });
  const country = (event.queryStringParameters?.country ?? '').toUpperCase();
  if (country.length !== 2) return json(400, { message: 'country query parameter is required' });
  const subdivisions = await new RegionReferenceAdapter(db).listSubdivisions(country);
  return json(200, { subdivisions });
}

// Current weekly advisor card for the dashboard (null until the cron generates one).
async function handleAdvisorCard(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  const advisor = await withTenantTx(db, user.id, () => new WeeklyAdvisorRepositoryAdapter(db).getCurrent());
  return json(200, { advisor });
}

// Highest summed-spend merchant for the current month, for the dashboard card.
async function handleTopMerchant(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  const merchants = await withTenantTx(db, user.id, () =>
    new InvoiceRepositoryAdapter(db).getTopMerchantsThisMonth(3),
  );
  return json(200, { merchants });
}

async function handleUsage(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  const quotaService = new QuotaService(new QuotaRepositoryAdapter(db));
  const resolver = new UploadAllowanceResolver(
    new HouseholdRepositoryAdapter(db),
    uploadQuotaAdapter(),
  );
  // Both cap and "used" follow whatever quota backs new uploads. When pooled, report the
  // pool counter alone: §6.3 carry-over already copied the owner's pre-pool spend into
  // the pool on activation, so adding the personal counter would double-count it. Outside
  // a pool, report the personal counter.
  const { cap, used } = await withTenantTx(db, user.id, async () => {
    const allowance = await resolver.resolve({ userId: user.id, role: user.role });
    const now = new Date();
    const used = allowance.isPool
      ? await quotaService.getUsed(allowance.quotaOwnerId, 'HOUSEHOLD_CREDITS', now)
      : await quotaService.getUsed(user.id, 'CREDITS', now);
    return { cap: allowance.cap, used };
  });
  // TESTER/ADMIN (and unlimited household pools) have an infinite cap; Infinity is not
  // representable in JSON (serializes to null), so signal it explicitly and null the numerics.
  const unlimited = !Number.isFinite(cap);
  return json(200, {
    used,
    cap: unlimited ? null : cap,
    remaining: unlimited ? null : Math.max(0, cap - used),
    unlimited,
  });
}

const SHA256_RE = /^[a-f0-9]{64}$/i;

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

  const locationMatch = path.match(/^\/invoices\/([^/]+)\/location$/);
  if (method === 'PUT' && locationMatch) return handleConfirmLocation(db, user, locationMatch[1], event, log);

  const shareMatch = path.match(/^\/invoices\/([^/]+)\/share$/);
  if (method === 'POST' && shareMatch) return handleCreateShare(db, user, shareMatch[1], log);

  const feedbackMatch = path.match(/^\/invoices\/([^/]+)\/feedback$/);
  if (method === 'POST' && feedbackMatch) return handleRecordFeedback(db, user, feedbackMatch[1], event, log);

  if (method === 'POST' && path === '/invoices/presign') return handlePresign(db, user, event, log);

  const detailMatch = path.match(/^\/invoices\/([^/]+)$/);
  if (method === 'GET' && detailMatch) return handleInvoiceDetail(db, user, detailMatch[1]);
  if (method === 'PUT' && detailMatch) return handleCorrectInvoice(db, user, detailMatch[1], event, log);
  if (method === 'DELETE' && detailMatch) return handleDeleteInvoice(db, user, detailMatch[1], log);

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
  const locationLabel = await resolveLocationLabel(db, rest.locationCountryCode, rest.locationRegionCode);
  return json(200, { ...rest, imageUrl, locationLabel });
}

// Human-readable "Region, Country" for the invoice header, resolved from the global
// ISO 3166 reference tables (no RLS). Returns null when no country is set.
async function resolveLocationLabel(
  db: PoolClient,
  countryCode: string | null,
  regionCode: string | null,
): Promise<string | null> {
  if (!countryCode) return null;
  const reference = new RegionReferenceAdapter(db);
  const countries = await reference.listCountries();
  const countryName = countries.find((c) => c.code === countryCode)?.name ?? countryCode;
  if (!regionCode) return countryName;
  const subdivisions = await reference.listSubdivisions(countryCode);
  const regionName = subdivisions.find((s) => s.code === regionCode)?.name;
  return regionName ? `${regionName}, ${countryName}` : countryName;
}

// Issues a public read-only share link for an invoice the tenant can see. Returns
// the /r/<token> URL (the token is the unguessable "magic id"; the invoice id is
// never exposed). 7-day expiry, owner-revocable — mirrors the household-invite flow.
async function handleCreateShare(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = new ShareInvoiceService(
    new InvoiceRepositoryAdapter(db),
    new InvoiceShareRepositoryAdapter(db),
    new SecureTokenAdapter(),
    buildKmsEncryption(REGION),
  );

  try {
    const share = await withTenantTx(db, user.id, () => service.createShare(user.id, invoiceId));
    log.info('invoice share created', { userId: user.id, invoiceId, shareId: share.shareId });
    const base = process.env.WEB_APP_URL ?? '';
    return json(201, { shareUrl: `${base}/r/${share.token}`, expiresAt: share.expiresAt });
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return json(404, { message: 'Invoice not found' });
    throw err;
  }
}

// Persists the tenant's accuracy verdict (UP/DOWN) on a parsed receipt; upserts so a
// re-rating overwrites the prior one. getById relies on RLS, so a cross-tenant id 404s.
async function handleRecordFeedback(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const service = new RecordFeedbackService(
    new InvoiceRepositoryAdapter(db),
    new InvoiceFeedbackRepositoryAdapter(db),
  );

  try {
    await withTenantTx(db, user.id, () => service.record(invoiceId, String(body.verdict ?? '')));
    log.info('invoice feedback recorded', { userId: user.id, invoiceId, verdict: body.verdict });
    return json(204, {});
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return json(404, { message: 'Invoice not found' });
    if (err instanceof InvalidFeedbackError) return json(400, { message: 'verdict must be UP or DOWN' });
    throw err;
  }
}

// Parses one review-screen line edit. A line is dropped (returns null) when its id
// is missing or its numerics are malformed, so a garbage entry can't corrupt the write.
function parseCorrectionLine(raw: unknown): CorrectInvoiceLine | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const line = raw as Record<string, unknown>;
  if (typeof line.id !== 'string') return null;
  const quantity = Number(line.quantity);
  const lineTotal = Number(line.lineTotal);
  if (!Number.isFinite(quantity) || !Number.isFinite(lineTotal)) return null;
  const unitPrice = line.unitPrice == null ? null : Number(line.unitPrice);
  return {
    id: line.id,
    productId: typeof line.productId === 'string' ? line.productId : null,
    quantity,
    unitPrice: unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : null,
    lineTotal,
  };
}

// Saves the review screen's corrections (16e): fixed date/total + per-line edits, then
// flips the invoice to PARSED. The downstream USER_CONFIRMED price-observation quality is
// driven by the stamped corrected_at at the existing location-confirm emission gate.
async function handleCorrectInvoice(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const lines = rawLines.map(parseCorrectionLine).filter((l): l is CorrectInvoiceLine => l !== null);
  const transactionDate = typeof body.transactionDate === 'string' ? body.transactionDate : null;
  const total = body.total == null ? null : Number(body.total);
  const input: CorrectInvoiceInput = {
    invoiceId,
    transactionDate,
    total: total != null && Number.isFinite(total) ? total : null,
    lines,
  };

  const service = new CorrectInvoiceService(new InvoiceRepositoryAdapter(db));
  try {
    await withTenantTx(db, user.id, () => service.correct(input));
    log.info('invoice corrected', { userId: user.id, invoiceId, lineCount: lines.length });
    return json(200, { status: 'PARSED', invoiceId });
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return json(404, { message: 'Invoice not found' });
    if (err instanceof InvoiceNotCorrectableError) return json(409, { message: 'Invoice cannot be corrected' });
    if (err instanceof InvalidCorrectionError) return json(400, { message: err.message });
    throw err;
  }
}

async function handleDeleteInvoice(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const service = new DeleteInvoiceService(
    new InvoiceRepositoryAdapter(db),
    new S3FileStorageAdapter(REGION, uploadsBucket),
    new IngestionLedgerAdapter(db),
  );

  try {
    await withTenantTx(db, user.id, () => service.delete(invoiceId));
    log.info('invoice deleted', { userId: user.id, invoiceId });
    return json(204, {});
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return json(404, { message: 'Invoice not found' });
    if (err instanceof InvoiceBlockedError) return json(409, { message: 'This receipt is being reprocessed and cannot be deleted yet' });
    if (err instanceof InvoiceNotDeletableError) return json(409, { message: 'Invoice is still processing' });
    throw err;
  }
}

// Optional browser geolocation (tier 2). Only a well-formed coordinate pair within
// valid bounds is forwarded; anything else is dropped so presign falls through to the
// profile tier rather than reverse-geocoding garbage.
function parseCoordinates(body: Record<string, unknown>): { lat: number; lon: number } | undefined {
  const lat = body.lat;
  const lon = body.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  return { lat, lon };
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
  const coordinates = parseCoordinates(body);

  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const quotaProvider = uploadQuotaAdapter();
  const allowanceResolver = new UploadAllowanceResolver(
    new HouseholdRepositoryAdapter(db),
    quotaProvider,
  );
  const service = new PresignService(
    new InvoiceRepositoryAdapter(db),
    new QuotaService(new QuotaRepositoryAdapter(db)),
    allowanceResolver,
    quotaProvider,
    quotaProvider,
    new S3FileStorageAdapter(REGION, uploadsBucket),
    new AwsLocationReverseGeocoderAdapter(REGION, process.env.LOCATION_PLACE_INDEX ?? ''),
    new RegionReferenceAdapter(db),
  );

  try {
    const result = await withTenantTx(db, user.id, () =>
      service.presign({
        tenantId: user.id,
        uploadedByUserId: user.id,
        role: user.role,
        imageSha256,
        contentType,
        coordinates,
      }),
    );
    log.info('presign issued', { userId: user.id, invoiceId: result.invoiceId });
    return json(201, result);
  } catch (err) {
    if (err instanceof UnsupportedUploadTypeError) return json(415, { message: 'Unsupported file type' });
    if (err instanceof PremiumRequiredError) return json(403, { message: 'PDF uploads require a premium plan' });
    if (err instanceof DuplicateInvoiceError) return json(409, { message: 'Receipt already scanned' });
    if (err instanceof QuotaExceededError) {
      // Quota is the sole AI-cost/abuse control; surface blocks so repeat offenders are
      // visible in CloudWatch (no per-tenant cap to tune — see 2026-06-22 amendment).
      log.warn('quota block', { event: 'quota_block', tenantId: user.id, quotaType: err.counter, used: err.used, cap: err.cap });
      return json(429, { message: 'Upload quota exceeded', used: err.used, cap: err.cap });
    }
    throw err;
  }
}

// Write-once location confirmation that releases (or holds) the invoice's price
// observations — the second half of the §6.5 data-quality gate. The deferred
// price_observation INSERT runs here under the same DB credentials the ingestion
// worker uses (both Lambdas read the one shared dbSecret — see WobblioBackendStack),
// so no extra grant is required. If a read-only api-handler DB role is ever
// introduced, it must keep INSERT on the (RLS-exempt) price_observation table.
async function handleConfirmLocation(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const service = new InvoiceLocationService(
    new InvoiceRepositoryAdapter(db),
    new RegionReferenceAdapter(db),
    new ContributorContextRepositoryAdapter(db),
    new PriceObservationStoreAdapter(db),
  );

  try {
    const locationStatus = await withTenantTx(db, user.id, () =>
      service.confirm(invoiceId, user.id, {
        countryCode: String(body.countryCode ?? ''),
        regionCode: String(body.regionCode ?? ''),
      }),
    );
    log.info('invoice location confirmed', { userId: user.id, invoiceId, locationStatus });
    return json(200, { locationStatus });
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return json(404, { message: 'Invoice not found' });
    if (err instanceof LocationAlreadySetError) return json(409, { message: 'Location already set' });
    if (err instanceof LocationNotConfirmableError) return json(409, { message: 'Invoice is not ready for a location' });
    if (err instanceof InvalidLocationError) return json(422, { message: err.message });
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
    new SqsInvoiceIngestionQueueAdapter(REGION, queueUrl),
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
