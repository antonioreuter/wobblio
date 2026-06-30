import type { SQSRecord } from 'aws-lambda';
import type { Pool, PoolClient } from 'pg';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { QuotaRepositoryAdapter } from '@infrastructure/adapters/quota/QuotaRepositoryAdapter';
import { NotificationRepositoryAdapter } from '@infrastructure/adapters/notifications/NotificationRepositoryAdapter';
import { MockPushAdapter } from '@infrastructure/adapters/notifications/MockPushAdapter';
import { buildPushNotifier } from '@infrastructure/adapters/notifications/pushNotifierFactory';
import { TelemetryRepositoryAdapter } from '@infrastructure/adapters/observability/TelemetryRepositoryAdapter';
import { BudgetRecyclerRepositoryAdapter } from '@infrastructure/adapters/budgets/BudgetRecyclerRepositoryAdapter';
import { BudgetRecyclerService } from '@core/services/budgets/BudgetRecyclerService';
import { QuotaService } from '@core/services/quota/QuotaService';
import { TokenMeter } from '@core/domain/tokenMeter';
import { estimateCostUsd } from '@core/domain/aiSpend';
import { shouldChargeIngestion } from '@core/domain/ingestionCharge';
import { isSystemFault, uploadFailureReasonCode } from '@core/domain/ingestion';
import type { InvoiceStatus } from '@core/domain/ingestion';
import { buildIngestionPush } from '@core/domain/pushNotification';
import { friendlyFailureMessage } from '@core/domain/failureReasons';
import { weekStart } from '@core/domain/week';
import type { IngestionOutcome } from '@core/services/ingestion/IngestionService';
import type { InvoiceTelemetryRecord } from '@core/ports/observability/ITelemetryRepository';
import type { QuotaType } from '@core/ports/quota/IQuotaRepository';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';

// The transaction shell shared by the legacy and agentic ingestion workers (Non-Functional
// 01 §1): unified transaction (process → charge → telemetry → COMMIT), post-COMMIT side
// effects, and the failure path (rollback → user-fault / quarantine / DLQ). The only
// per-pipeline differences are which service runs and the telemetry `pipeline_type`.

// Anything a pipeline service can be driven as — both IngestionService and
// AgenticIngestionService satisfy this.
export interface IngestionPipeline {
  process(message: IngestionMessage): Promise<IngestionOutcome>;
}

export type PipelineType = InvoiceTelemetryRecord['pipelineType'];

// Budgets a freshly-parsed invoice can move; only PARSED/NEEDS_REVIEW invoices count.
const COUNTS_TOWARD_BUDGET = new Set(['PARSED', 'NEEDS_REVIEW']);

// Mirrors the SQS redrive policy (maxReceiveCount). On the final delivery the message goes to
// the DLQ, so this is the last chance to flip the invoice out of PROCESSING.
const MAX_RECEIVE_COUNT = 3;

// PostgreSQL SQLSTATE class 23 = integrity_constraint_violation. Deterministic: the same row
// fails every redelivery, so retrying only burns the redrive budget and DLQs an unfixable msg.
const PG_CONSTRAINT_VIOLATION_CLASS = '23';

function isNonRetryable(err: unknown): boolean {
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith(PG_CONSTRAINT_VIOLATION_CLASS);
}

export interface RecordContext {
  record: SQSRecord;
  client: PoolClient;
  pool: Pool;
  workerStart: number;
  log: LambdaLogger;
}

// Runs one SQS record through the given pipeline. Returns true when the record should be
// reported as a batch-item failure (SQS retry). `buildService` receives the per-record meter so
// the worker can both wire the metering decorators and read the consumed tokens for charging.
export async function runIngestionRecord(
  ctx: RecordContext,
  buildService: (client: PoolClient, meter: TokenMeter) => IngestionPipeline,
  pipelineType: PipelineType,
): Promise<boolean> {
  const { record, client, workerStart, log } = ctx;
  try {
    const message = JSON.parse(record.body) as IngestionMessage;
    await client.query('BEGIN');

    // Meter every model call this run so the worker can charge the actual tokens consumed; the
    // decorators (wired inside buildService) keep the pipeline services unaware of quota.
    const meter = new TokenMeter();
    const service = buildService(client, meter);

    const outcome = await service.process(message);

    // Charge the actual tokens consumed, only when a model actually ran (charge-by-timing,
    // §6/§03.1). Inside the still-open tenant transaction, so it commits atomically with the
    // ledger claim + invoice rows — a redelivery short-circuits on the ledger, never double-charges.
    if (shouldChargeIngestion(outcome.handled, meter.total)) {
      await chargeIngestion(client, message, meter.total, log);
    }

    // Per-invoice cost & performance telemetry (Non-Functional 01), in the same transaction so
    // it is atomic + RLS-scoped. Only for handled runs (a duplicate delivery did no real work).
    const telemetry = buildTelemetry(message, meter, workerStart, outcome, pipelineType);
    if (telemetry) await new TelemetryRepositoryAdapter(client).recordInvoiceTelemetry(telemetry);

    await client.query('COMMIT');
    await runPostCommit(ctx, message, outcome, telemetry);
    return false;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    return await handleRecordError(ctx, err);
  }
}

function buildTelemetry(
  message: IngestionMessage,
  meter: TokenMeter,
  workerStart: number,
  outcome: IngestionOutcome,
  pipelineType: PipelineType,
): InvoiceTelemetryRecord | undefined {
  if (!outcome.handled) return undefined;
  return {
    tenantId: message.tenantId,
    invoiceId: message.invoiceId,
    pipelineType,
    processingMs: Date.now() - workerStart,
    inputTokens: meter.inputTotal,
    outputTokens: meter.outputTotal,
    costUsd: estimateCostUsd(meter.stageBreakdown()),
    status: outcome.status ?? 'UNKNOWN',
  };
}

// Post-COMMIT logs + best-effort side effects. A failure here must never roll back or retry the
// already-committed ingestion.
async function runPostCommit(
  ctx: RecordContext,
  message: IngestionMessage,
  outcome: IngestionOutcome,
  telemetry: InvoiceTelemetryRecord | undefined,
): Promise<void> {
  const { record, client, pool, workerStart, log } = ctx;
  log.info('ingestion processed', {
    invoiceId: message.invoiceId,
    handled: outcome.handled,
    status: outcome.status,
    failureReasonCode: outcome.failureReasonCode,
  });

  // End-to-end processing time, rolled up daily into kpi_daily. Skip duplicate deliveries.
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
  // Per-invoice telemetry log (Non-Functional 01 §5), mirroring the committed row.
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
  if (outcome.emissionGate) {
    log.info('emission gate', {
      invoiceId: message.invoiceId,
      suppressed: outcome.emissionGate.suppressed,
      integral: outcome.emissionGate.integral,
      reasons: outcome.emissionGate.reasons,
    });
  }

  // Fire 85%/100% budget alerts at upload time. Best-effort.
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

  // Terminal-status device push (16f): tell the device a receipt is ready. Best-effort,
  // post-COMMIT on the now-idle client (the worker pool is max:1, so don't borrow another
  // connection) — the SNS adapter swallows its own failures, but guard anyway so a push
  // problem never rolls back or retries the already-committed ingestion.
  if (outcome.handled && outcome.status) {
    await pushTerminalStatus(client, message.tenantId, message.invoiceId, outcome.status, log);
  }

  // Operator reprocess-on-behalf succeeded (§07): tell the owner. Best-effort, post-COMMIT.
  if (message.reprocess && outcome.status && COUNTS_TOWARD_BUDGET.has(outcome.status)) {
    await notifyReprocessed(client, message.tenantId, message.invoiceId, log);
  }
}

// Push the "receipt ready" notification for a freshly-parsed invoice (PARSED/NEEDS_REVIEW).
// Non-terminal/duplicate statuses build no payload and are silently skipped.
async function pushTerminalStatus(
  client: PoolClient,
  tenantId: string,
  invoiceId: string,
  status: InvoiceStatus,
  log: LambdaLogger,
): Promise<void> {
  const payload = buildIngestionPush(status, invoiceId);
  if (!payload) return;
  try {
    await buildPushNotifier(client).push(tenantId, payload.title, payload.body, payload.data);
  } catch (pushErr) {
    log.error('terminal-status push failed', {
      invoiceId,
      err: pushErr instanceof Error ? pushErr : new Error(String(pushErr)),
    });
  }
}

// The rollback failure path. Returns true when the record should be retried (batch-item failure).
// Awaits the recovery writes — they run BEGIN/COMMIT on the same client the caller releases.
async function handleRecordError(ctx: RecordContext, err: unknown): Promise<boolean> {
  const { record, client, pool, log } = ctx;
  const cause = (err as { cause?: unknown }).cause;
  log.error('ingestion failed', {
    messageId: record.messageId,
    err: err instanceof Error ? err : new Error(String(err)),
    cause: cause instanceof Error ? cause : cause ? new Error(String(cause)) : undefined,
  });
  // Pre-AI user-fault reject (§06): fail the invoice plain (deletable, no quarantine, no charge)
  // and drop the message — a replay fails identically.
  if (!isSystemFault(err)) {
    await failUserFault(client, record, err, log);
    return false;
  }
  // Deterministic constraint violations can't be fixed by replay: quarantine + drop the message.
  if (isNonRetryable(err)) {
    log.error('non-retryable constraint violation, failing fast', {
      messageId: record.messageId,
      code: (err as { code?: string }).code,
    });
    await quarantineInvoice(client, pool, record, err, log);
    return false;
  }
  // Final delivery before the DLQ: quarantine so the invoice leaves PROCESSING and is held for
  // operator reprocess-on-behalf (§03.6). Best-effort and isolated — never throws.
  if (Number(record.attributes.ApproximateReceiveCount) >= MAX_RECEIVE_COUNT) {
    await quarantineInvoice(client, pool, record, err, log);
  }
  return true;
}

// Quarantine an invoice after an our-stack crash, in its own committed transaction (RLS needs
// the tenant context first). Charges nothing (success-time charging only). The owner is notified
// with a friendly, internals-safe reason. Swallows its own errors.
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
  // Notify only on the transition INTO quarantine — a redelivery matches 0 rows. The client
  // is idle post-COMMIT; reuse it (the worker pool is max:1) instead of borrowing from pool.
  if (transitioned) await notifySystemFault(client, tenantId, invoiceId, log);
}

// Fail an invoice on a pre-AI user-fault reject (§06) in its own committed transaction. Plain
// FAILED_PROCESSING + reason code — no quarantine, so the user can delete and retry; no charge.
async function failUserFault(client: PoolClient, record: SQSRecord, err: unknown, log: LambdaLogger): Promise<void> {
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

// The internal root cause stored in system_fault_reason — never sent to the user. Capped so a
// giant SDK stack string doesn't bloat the row.
function systemFaultReason(err: unknown): string {
  const code = (err as { code?: unknown }).code;
  const message = err instanceof Error ? err.message : String(err);
  return (code ? `[${String(code)}] ${message}` : message).slice(0, 500);
}

async function notifySystemFault(client: PoolClient, tenantId: string, invoiceId: string, log: LambdaLogger): Promise<void> {
  const title = "We couldn't process your receipt";
  const body = friendlyFailureMessage('SYSTEM_FAULT');
  const data = buildIngestionPush('FAILED_PROCESSING', invoiceId)?.data;
  try {
    await new NotificationRepositoryAdapter(client).create({
      tenantId, kind: 'invoice_system_fault', title, body, budgetId: null, ttlDays: 7,
    });
    await buildPushNotifier(client).push(tenantId, title, body, data);
  } catch (notifyErr) {
    log.error('system-fault notification failed', {
      invoiceId,
      err: notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)),
    });
  }
}

// Charge the credits a successful run consumed against the counter PRESIGN committed to the
// invoice (quota_pooled), not a fresh membership resolve. Runs inside the caller's committed tx.
async function chargeIngestion(client: PoolClient, message: IngestionMessage, tokens: number, log: LambdaLogger): Promise<void> {
  const target = await new InvoiceRepositoryAdapter(client).findChargeTarget(message.invoiceId);
  const pooled = target?.quotaPooled === true && target.householdId !== null;
  const counter: QuotaType = pooled ? 'HOUSEHOLD_CREDITS' : 'CREDITS';
  const quotaOwnerId = pooled ? target!.householdId! : message.tenantId;

  const week = weekStart(new Date().toISOString().slice(0, 10));
  await new QuotaService(new QuotaRepositoryAdapter(client)).charge(quotaOwnerId, counter, week, tokens);
  log.info('ingestion credits charged', { invoiceId: message.invoiceId, counter, tokens });

  // §07.5: an operator reprocess that lands in a later week than the original upload charges the
  // CURRENT week. Emit a KPI log so cross-week reprocessing is visible; only when weeks differ.
  if (message.reprocess && target) {
    const originalWeek = weekStart(target.createdAt.slice(0, 10));
    if (originalWeek !== week) {
      log.info('reprocess cross week', { invoiceId: message.invoiceId, tokens, originalWeek, chargedWeek: week });
    }
  }
}

async function notifyReprocessed(client: PoolClient, tenantId: string, invoiceId: string, log: LambdaLogger): Promise<void> {
  const title = 'Your receipt is ready';
  const body = "We finished processing your receipt — it's now in your invoices.";
  const data = buildIngestionPush('PARSED', invoiceId)?.data;
  try {
    await new NotificationRepositoryAdapter(client).create({
      tenantId, kind: 'invoice_reprocessed', title, body, budgetId: null, ttlDays: 7,
    });
    await buildPushNotifier(client).push(tenantId, title, body, data);
  } catch (notifyErr) {
    log.error('reprocessed notification failed', {
      invoiceId,
      err: notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)),
    });
  }
}
