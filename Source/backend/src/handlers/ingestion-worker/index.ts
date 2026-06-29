import type { SQSEvent, SQSBatchResponse, SQSRecord, Context } from 'aws-lambda';
import type { Pool, PoolClient } from 'pg';
import { createLambdaLogger, type LambdaLogger } from '@infrastructure/logging/logger';
import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { buildPool } from '@infrastructure/config/db';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { BedrockTitanEmbedderAdapter } from '@infrastructure/adapters/data-intelligence/BedrockTitanEmbedderAdapter';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import { IngestionService } from '@core/services/ingestion/IngestionService';
import { BudgetRecyclerRepositoryAdapter } from '@infrastructure/adapters/budgets/BudgetRecyclerRepositoryAdapter';
import { NotificationRepositoryAdapter } from '@infrastructure/adapters/notifications/NotificationRepositoryAdapter';
import { MockPushAdapter } from '@infrastructure/adapters/notifications/MockPushAdapter';
import { BudgetRecyclerService } from '@core/services/budgets/BudgetRecyclerService';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { QuotaRepositoryAdapter } from '@infrastructure/adapters/quota/QuotaRepositoryAdapter';
import { QuotaService } from '@core/services/quota/QuotaService';
import { MeteringBedrockConverse } from '@core/services/ai/MeteringBedrockConverse';
import { MeteringBedrockEmbedder } from '@core/services/ai/MeteringBedrockEmbedder';
import { TelemetryRepositoryAdapter } from '@infrastructure/adapters/observability/TelemetryRepositoryAdapter';
import { TokenMeter } from '@core/domain/tokenMeter';
import { estimateCostUsd } from '@core/domain/aiSpend';
import type { InvoiceTelemetryRecord } from '@core/ports/observability/ITelemetryRepository';
import { shouldChargeIngestion } from '@core/domain/ingestionCharge';
import { isSystemFault, uploadFailureReasonCode } from '@core/domain/ingestion';
import { friendlyFailureMessage } from '@core/domain/failureReasons';
import { weekStart } from '@core/domain/week';
import type { QuotaType } from '@core/ports/quota/IQuotaRepository';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

// Budgets a freshly-parsed invoice can move; only PARSED/NEEDS_REVIEW invoices count.
const COUNTS_TOWARD_BUDGET = new Set(['PARSED', 'NEEDS_REVIEW']);

// Mirrors the SQS redrive policy (maxReceiveCount) in WobblioBackendStack. On the
// final delivery the message goes to the DLQ, so this is the last chance to flip the
// invoice out of PROCESSING.
const MAX_RECEIVE_COUNT = 3;

// PostgreSQL SQLSTATE class 23 = integrity_constraint_violation (not-null, FK, unique,
// check). These are deterministic: the same parsed row fails every redelivery, so
// retrying only burns the redrive budget and DLQs a message no replay can fix.
const PG_CONSTRAINT_VIOLATION_CLASS = '23';

function isNonRetryable(err: unknown): boolean {
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith(PG_CONSTRAINT_VIOLATION_CLASS);
}

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('ingestion-worker', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  // Model IDs resolve through the canonical registry (admin-console 03) so an admin
  // swap is picked up on the next cold start — no hardcoded IDs in the worker.
  const modelRegistry = new SsmModelRegistryAdapter(REGION);
  const visionModelId = await modelRegistry.getModelId('vision_parser');
  // The vision model rejects PDF document blocks, so PDFs parse exclusively on the
  // dedicated, doc-capable pdf_parser model (same receipt prompt + schema). No
  // fallback: the param must be provisioned in every environment.
  const pdfModelId = await modelRegistry.getModelId('pdf_parser');
  const auxiliaryModelId = await modelRegistry.getModelId('auxiliary');
  const embedderModelId = await modelRegistry.getModelId('embedder');
  const converse = new BedrockConverseAdapter(REGION);
  const embedder = new BedrockTitanEmbedderAdapter(REGION, embedderModelId);
  // Per-upload size/page limits for the worker-start validation (§06). Shared across
  // records in this warm container (caches the SSM params).
  const uploadLimits = new SsmUploadQuotaAdapter(REGION);

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const workerStart = Date.now();
    const client = await pool.connect();
    try {
      const message = JSON.parse(record.body) as IngestionMessage;
      await client.query('BEGIN');

      // Meter every model call this run so the worker can charge the actual tokens
      // consumed; the decorators keep the pipeline services unaware of quota.
      const meter = new TokenMeter();
      const meteredConverse = new MeteringBedrockConverse(converse, meter);
      const meteredEmbedder = new MeteringBedrockEmbedder(embedder, meter);

      const visionParser = new VisionParseService(meteredConverse, visionModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION);
      const documentParser = new VisionParseService(meteredConverse, pdfModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION);
      const merchantCatalog = new MerchantCatalogAdapter(client);
      const productCatalog = new ProductCatalogAdapter(client);
      const service = new IngestionService(
        new TenantContextAdapter(client),
        new IngestionLedgerAdapter(client),
        new S3FileStorageAdapter(REGION, uploadsBucket),
        visionParser,
        documentParser,
        new MerchantResolver(merchantCatalog, meteredConverse, auxiliaryModelId),
        new ProductNormalizer(productCatalog, meteredEmbedder, meteredConverse, auxiliaryModelId),
        new InvoiceClassifier(merchantCatalog, meteredConverse, auxiliaryModelId),
        new TagGenerator(),
        new InvoiceRepositoryAdapter(client),
        new PriceObservationStoreAdapter(client),
        new ContributorContextRepositoryAdapter(client),
        new RegionReferenceAdapter(client),
        uploadLimits,
      );

      const outcome = await service.process(message);

      // Charge the actual tokens consumed, only when a model actually ran (charge-by-timing,
      // §6/§03.1). The metered total is the ground truth — an `unreadable` verdict and a
      // fuzzy duplicate both spent tokens and are charged; a duplicate SQS delivery spent
      // none. Inside the still-open tenant transaction, so the charge commits atomically
      // with the ledger claim + invoice rows — a redelivery short-circuits on the ledger
      // and never double-charges.
      if (shouldChargeIngestion(outcome.handled, meter.total)) {
        await chargeIngestion(client, message, meter.total, log);
      }

      // Per-invoice cost & performance telemetry (non-functional 01), inside the still-open
      // tenant transaction so it commits atomically with the invoice rows and is RLS-scoped.
      // Only for handled runs (a duplicate SQS delivery did no real work). cost_usd is the
      // per-role estimate over the metered stages — same pricing source as the daily rollup.
      let telemetry: InvoiceTelemetryRecord | undefined;
      if (outcome.handled) {
        telemetry = {
          tenantId: message.tenantId,
          invoiceId: message.invoiceId,
          pipelineType: 'LEGACY',
          processingMs: Date.now() - workerStart,
          inputTokens: meter.inputTotal,
          outputTokens: meter.outputTotal,
          costUsd: estimateCostUsd(meter.stageBreakdown()),
          status: outcome.status ?? 'UNKNOWN',
        };
        await new TelemetryRepositoryAdapter(client).recordInvoiceTelemetry(telemetry);
      }

      await client.query('COMMIT');
      log.info('ingestion processed', {
        invoiceId: message.invoiceId,
        handled: outcome.handled,
        status: outcome.status,
        failureReasonCode: outcome.failureReasonCode,
      });

      // End-to-end processing time, rolled up daily into kpi_daily via Logs Insights.
      // Skip duplicate SQS deliveries (handled:false) — they did no real work.
      if (outcome.handled) {
        const workerMs = Date.now() - workerStart;
        const sentTimestamp = Number(record.attributes.SentTimestamp);
        const totalMs = Number.isFinite(sentTimestamp) ? Date.now() - sentTimestamp : workerMs;
        log.info('ingestion timing', {
          invoiceId: message.invoiceId,
          status: outcome.status,
          totalMs,
          workerMs,
          queueWaitMs: totalMs - workerMs,
        });
      }
      // Per-invoice telemetry log (non-functional 01 §5), mirroring the committed
      // invoice_telemetry row — feeds the per-pipeline cost/perf comparison.
      if (telemetry) {
        log.info('invoice_processed', {
          invoiceId: telemetry.invoiceId,
          pipelineType: telemetry.pipelineType,
          processingMs: telemetry.processingMs,
          tokensConsumed: { input: telemetry.inputTokens, output: telemetry.outputTokens },
          costUsd: telemetry.costUsd,
          status: telemetry.status,
        });
      }
      if (outcome.receipt) {
        log.debug('parsed receipt', { invoiceId: message.invoiceId, receipt: outcome.receipt });
      }
      // Emission gate (§6.5): which invoices contributed to the global price store and why
      // a non-integral parse was held back — plain log, rolled up for tuning (no EMF).
      if (outcome.emissionGate) {
        log.info('emission gate', {
          invoiceId: message.invoiceId,
          suppressed: outcome.emissionGate.suppressed,
          integral: outcome.emissionGate.integral,
          reasons: outcome.emissionGate.reasons,
        });
      }

      // Fire 85%/100% budget alerts at upload time. Best-effort: a failure here must
      // never roll back or retry the (already committed) ingestion.
      if (outcome.handled && outcome.status && COUNTS_TOWARD_BUDGET.has(outcome.status)) {
        try {
          const budgetAlerts = new BudgetRecyclerService(
            new BudgetRecyclerRepositoryAdapter(pool),
            new NotificationRepositoryAdapter(pool),
            new MockPushAdapter(),
          );
          const today = new Date().toISOString().slice(0, 10);
          const { alertsFired } = await budgetAlerts.evaluateForInvoice(message.invoiceId, today);
          if (alertsFired > 0) log.info('budget alerts fired', { invoiceId: message.invoiceId, alertsFired });
        } catch (alertErr) {
          log.error('budget alert evaluation failed', {
            invoiceId: message.invoiceId,
            err: alertErr instanceof Error ? alertErr : new Error(String(alertErr)),
          });
        }
      }

      // Operator reprocess-on-behalf succeeded (§07): the run came back to a usable status,
      // so tell the owner. Best-effort, post-COMMIT (mirrors the budget/system-fault notifies).
      if (message.reprocess && outcome.status && COUNTS_TOWARD_BUDGET.has(outcome.status)) {
        await notifyReprocessed(pool, message.tenantId, message.invoiceId, log);
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      const cause = (err as { cause?: unknown }).cause;
      log.error('ingestion failed', {
        messageId: record.messageId,
        err: err instanceof Error ? err : new Error(String(err)),
        cause: cause instanceof Error ? cause : cause ? new Error(String(cause)) : undefined,
      });
      // Pre-AI user-fault reject (§06: oversize / too many pages / unsupported format that
      // reached the worker). Fail the invoice plain — deletable, no quarantine, no charge —
      // and drop the message (no retry/DLQ; a replay fails identically). The "why?" surface
      // reads the reason code.
      if (!isSystemFault(err)) {
        await failUserFault(client, record, err, log);
        continue;
      }
      // Deterministic constraint violations can't be fixed by replay. Quarantine the
      // invoice now and drop the message (omit it from batchItemFailures so SQS deletes
      // it) — no wasted retries, no DLQ noise. The structured error log above is the record.
      if (isNonRetryable(err)) {
        log.error('non-retryable constraint violation, failing fast', {
          messageId: record.messageId,
          code: (err as { code?: string }).code,
        });
        await quarantineInvoice(client, pool, record, err, log);
        continue;
      }
      // Final delivery before the DLQ: quarantine the invoice so it leaves the non-terminal
      // PROCESSING state (the rolled-back run persisted no status) and is held for operator
      // reprocess-on-behalf (§03.6). Best-effort and isolated — never throws.
      if (Number(record.attributes.ApproximateReceiveCount) >= MAX_RECEIVE_COUNT) {
        await quarantineInvoice(client, pool, record, err, log);
      }
      batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};

// Quarantine an invoice after an our-stack crash, in its own committed transaction (RLS
// needs the tenant context first). Runs after the main transaction rolled back, so it
// reuses the same client. Credits are charged at success-time only, so a quarantined run
// charges nothing — there is no refund to make. The invoice is held (system_fault_reason
// set) for operator reprocess-on-behalf and the owner is notified with a friendly,
// internals-safe reason. Swallows its own errors — a failure here must not break the batch
// response or re-throw into the handler.
async function quarantineInvoice(
  client: PoolClient,
  pool: Pool,
  record: SQSRecord,
  err: unknown,
  log: LambdaLogger,
): Promise<void> {
  const { invoiceId, tenantId } = JSON.parse(record.body) as IngestionMessage;
  let transitioned = false;
  try {
    await client.query('BEGIN');
    await new TenantContextAdapter(client).setTenantId(tenantId);
    transitioned = await new InvoiceRepositoryAdapter(client).quarantine(invoiceId, systemFaultReason(err));
    await client.query('COMMIT');
    log.info('invoice quarantined (system fault)', { invoiceId, transitioned });
  } catch (quarantineErr) {
    await client.query('ROLLBACK').catch(() => undefined);
    log.error('could not quarantine invoice', {
      messageId: record.messageId,
      err: quarantineErr instanceof Error ? quarantineErr : new Error(String(quarantineErr)),
    });
    return;
  }
  // Notify only on the transition INTO quarantine — a redelivery of an already-quarantined
  // invoice matches 0 rows and must not re-notify/re-push the owner.
  if (transitioned) await notifySystemFault(pool, tenantId, invoiceId, log);
}

// Fail an invoice on a pre-AI user-fault reject (§06) in its own committed transaction
// (the main tx rolled back; RLS needs the tenant context first). Plain FAILED_PROCESSING
// + reason code — no quarantine, so the user can delete and retry; no charge (no model
// ran). Swallows its own errors so the batch response is never broken.
async function failUserFault(
  client: PoolClient,
  record: SQSRecord,
  err: unknown,
  log: LambdaLogger,
): Promise<void> {
  const { invoiceId, tenantId } = JSON.parse(record.body) as IngestionMessage;
  const reasonCode = uploadFailureReasonCode(err);
  try {
    await client.query('BEGIN');
    await new TenantContextAdapter(client).setTenantId(tenantId);
    await new InvoiceRepositoryAdapter(client).markFailed(invoiceId, reasonCode);
    await client.query('COMMIT');
    log.info('invoice failed (user fault)', { invoiceId, reasonCode });
  } catch (failErr) {
    await client.query('ROLLBACK').catch(() => undefined);
    log.error('could not fail invoice', {
      messageId: record.messageId,
      err: failErr instanceof Error ? failErr : new Error(String(failErr)),
    });
  }
}

// The internal root cause stored in system_fault_reason — never sent to the user. Capped
// so a giant SDK stack string doesn't bloat the row.
function systemFaultReason(err: unknown): string {
  const code = (err as { code?: unknown }).code;
  const message = err instanceof Error ? err.message : String(err);
  return (code ? `[${String(code)}] ${message}` : message).slice(0, 500);
}

// Best-effort owner notification with the friendly §03.4 reason. Uses a fresh pool
// connection (the SECURITY DEFINER insert bypasses RLS) and never throws.
async function notifySystemFault(pool: Pool, tenantId: string, invoiceId: string, log: LambdaLogger): Promise<void> {
  const title = "We couldn't process your receipt";
  const body = friendlyFailureMessage('SYSTEM_FAULT');
  try {
    await new NotificationRepositoryAdapter(pool).create({
      tenantId, kind: 'invoice_system_fault', title, body, budgetId: null, ttlDays: 7,
    });
    await new MockPushAdapter().push(tenantId, title, body);
  } catch (notifyErr) {
    log.error('system-fault notification failed', {
      invoiceId,
      err: notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)),
    });
  }
}

// Charge the credits a successful run consumed against the counter PRESIGN committed to
// the invoice (quota_pooled), not a fresh membership resolve: a join/leave in the
// presign→worker window must not redirect the charge to a different counter than the one
// presign checked (and than the invoice is attributed to). Runs inside the caller's
// committed tenant transaction.
async function chargeIngestion(
  client: PoolClient,
  message: IngestionMessage,
  tokens: number,
  log: LambdaLogger,
): Promise<void> {
  const target = await new InvoiceRepositoryAdapter(client).findChargeTarget(message.invoiceId);
  const pooled = target?.quotaPooled === true && target.householdId !== null;
  const counter: QuotaType = pooled ? 'HOUSEHOLD_CREDITS' : 'CREDITS';
  const quotaOwnerId = pooled ? target!.householdId! : message.tenantId;

  const week = weekStart(new Date().toISOString().slice(0, 10));
  await new QuotaService(new QuotaRepositoryAdapter(client)).charge(quotaOwnerId, counter, week, tokens);
  log.info('ingestion credits charged', { invoiceId: message.invoiceId, counter, tokens });

  // §07.5: an operator reprocess that lands in a later week than the original upload charges
  // the CURRENT week. Emit a KPI log (rolled into kpi_daily) so cross-week reprocessing is
  // visible; only when the weeks actually differ.
  if (message.reprocess && target) {
    const originalWeek = weekStart(target.createdAt.slice(0, 10));
    if (originalWeek !== week) {
      log.info('reprocess cross week', { invoiceId: message.invoiceId, tokens, originalWeek, chargedWeek: week });
    }
  }
}

// Best-effort owner notification that an operator reprocess succeeded (§07.2). Fresh pool
// connection (SD insert bypasses RLS); never throws into the post-COMMIT path.
async function notifyReprocessed(pool: Pool, tenantId: string, invoiceId: string, log: LambdaLogger): Promise<void> {
  const title = 'Your receipt is ready';
  const body = "We finished processing your receipt — it's now in your invoices.";
  try {
    await new NotificationRepositoryAdapter(pool).create({
      tenantId, kind: 'invoice_reprocessed', title, body, budgetId: null, ttlDays: 7,
    });
    await new MockPushAdapter().push(tenantId, title, body);
  } catch (notifyErr) {
    log.error('reprocessed notification failed', {
      invoiceId,
      err: notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)),
    });
  }
}
