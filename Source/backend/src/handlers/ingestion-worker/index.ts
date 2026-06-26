import type { SQSEvent, SQSBatchResponse, SQSRecord, Context } from 'aws-lambda';
import type { PoolClient } from 'pg';
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
import { weekStart } from '@core/domain/week';
import type { UserRole } from '@core/ports/identity/IAppUserRepository';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

// Budgets a freshly-parsed invoice can move; only PARSED/NEEDS_REVIEW invoices count.
const COUNTS_TOWARD_BUDGET = new Set(['PARSED', 'NEEDS_REVIEW']);

// Mirrors the SQS redrive policy (maxReceiveCount) in WobblioBackendStack. On the
// final delivery the message goes to the DLQ, so this is the last chance to flip the
// invoice out of PROCESSING.
const MAX_RECEIVE_COUNT = 3;

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

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const workerStart = Date.now();
    const client = await pool.connect();
    try {
      const message = JSON.parse(record.body) as IngestionMessage;
      await client.query('BEGIN');

      const visionParser = new VisionParseService(converse, visionModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION);
      const documentParser = new VisionParseService(converse, pdfModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION);
      const merchantCatalog = new MerchantCatalogAdapter(client);
      const productCatalog = new ProductCatalogAdapter(client);
      const service = new IngestionService(
        new TenantContextAdapter(client),
        new IngestionLedgerAdapter(client),
        new S3FileStorageAdapter(REGION, uploadsBucket),
        visionParser,
        documentParser,
        new MerchantResolver(merchantCatalog, converse, auxiliaryModelId),
        new ProductNormalizer(productCatalog, embedder, converse, auxiliaryModelId),
        new InvoiceClassifier(merchantCatalog, converse, auxiliaryModelId),
        new TagGenerator(),
        new InvoiceRepositoryAdapter(client),
        new PriceObservationStoreAdapter(client),
        new ContributorContextRepositoryAdapter(client),
        new RegionReferenceAdapter(client),
      );

      const outcome = await service.process(message);
      await client.query('COMMIT');
      log.info('ingestion processed', {
        invoiceId: message.invoiceId,
        handled: outcome.handled,
        status: outcome.status,
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
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      const cause = (err as { cause?: unknown }).cause;
      log.error('ingestion failed', {
        messageId: record.messageId,
        err: err instanceof Error ? err : new Error(String(err)),
        cause: cause instanceof Error ? cause : cause ? new Error(String(cause)) : undefined,
      });
      // Final delivery before the DLQ: move the invoice out of the non-terminal
      // PROCESSING state so it surfaces as failed and becomes deletable (the
      // rolled-back run persisted no status). Best-effort and isolated — never throws.
      if (Number(record.attributes.ApproximateReceiveCount) >= MAX_RECEIVE_COUNT) {
        await markInvoiceFailed(client, record, log);
      }
      batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};

// Flip an invoice to FAILED_PROCESSING in its own committed transaction (RLS needs
// the tenant context first). Refund is attempted only on the first flip — the guarded
// UPDATE makes redelivery a no-op so a re-processed record never refunds twice
// (idempotency-first, invariant #7). Runs after the main transaction rolled back, so it
// can reuse the same client. Swallows its own errors — a failure here must not break the
// batch response or re-throw into the handler.
async function markInvoiceFailed(client: PoolClient, record: SQSRecord, log: LambdaLogger): Promise<void> {
  try {
    const { invoiceId, tenantId } = JSON.parse(record.body) as IngestionMessage;
    const week = weekStart(new Date().toISOString().slice(0, 10));

    await client.query('BEGIN');
    await new TenantContextAdapter(client).setTenantId(tenantId);

    // Atomic transition: only the first delivery flips PENDING→FAILED and gets the row.
    // rowCount 0 means it was already FAILED (or gone) — skip the non-idempotent refund.
    const flip = await client.query<{ household_id: string | null }>(
      `UPDATE invoice SET status = 'FAILED_PROCESSING'
       WHERE id = $1 AND status <> 'FAILED_PROCESSING'
       RETURNING household_id`,
      [invoiceId],
    );
    if (flip.rowCount === 0) {
      await client.query('COMMIT');
      log.info('invoice already FAILED_PROCESSING, refund skipped', { invoiceId });
      return;
    }

    await refundFailedUpload(client, invoiceId, tenantId, flip.rows[0].household_id, week, log);

    await client.query('COMMIT');
    log.info('invoice marked FAILED_PROCESSING after final attempt', { invoiceId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    log.error('could not mark invoice failed', {
      messageId: record.messageId,
      err: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

// Credit back one upload for a final-attempt failure, capped per week. Household
// uploads refund the household pool; personal uploads refund the user's counter.
async function refundFailedUpload(
  client: PoolClient,
  invoiceId: string,
  tenantId: string,
  householdId: string | null,
  week: string,
  log: LambdaLogger,
): Promise<void> {
  const quotaOwnerId = householdId ?? tenantId;
  const counterType = householdId ? 'HOUSEHOLD_UPLOADS' : 'UPLOADS';

  const userResult = await client.query<{ role: string }>(
    `SELECT role FROM app_user WHERE id = $1`,
    [tenantId],
  );
  const role = (userResult.rows[0]?.role ?? 'STANDARD') as UserRole;

  const refundCap = await new SsmUploadQuotaAdapter(REGION).getFailureRefundCap(role);
  const quotaRepo = new QuotaRepositoryAdapter(client);
  const refundsUsed = await quotaRepo.getUsed(tenantId, 'UPLOAD_FAILURE_REFUNDS', week);

  if (refundsUsed >= refundCap) {
    log.info('quota_failure_refund_blocked', { invoiceId, refundsUsed, cap: refundCap });
    return;
  }

  await quotaRepo.decrement(quotaOwnerId, counterType, week);
  await quotaRepo.increment(tenantId, 'UPLOAD_FAILURE_REFUNDS', week);
  log.info('invoice failure refunded', { invoiceId, counterType });
}
