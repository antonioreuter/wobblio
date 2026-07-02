import type { SQSEvent, SQSBatchResponse, Context } from 'aws-lambda';
import type { PoolClient } from 'pg';
import { createLambdaLogger, type LambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { withTenantTx } from '../api-handler/shared';
import { DataRequestRepositoryAdapter } from '@infrastructure/adapters/gdpr/DataRequestRepositoryAdapter';
import { ExportDataSourceAdapter } from '@infrastructure/adapters/gdpr/ExportDataSourceAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { JsZipArchiverAdapter } from '@infrastructure/adapters/admin/JsZipArchiverAdapter';
import { SesEmailAdapter } from '@infrastructure/adapters/notifications/SesEmailAdapter';
import { buildPushNotifier } from '@infrastructure/adapters/notifications/pushNotifierFactory';
import { ExportWorkerService } from '@core/services/gdpr/ExportWorkerService';
import type { ExportMessage } from '@core/ports/gdpr/IExportQueue';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

// New, dedicated SQS consumer — deliberately not reusing ingestionWorkerShell.ts, which is
// purpose-built for charging/telemetry/budget-alerts, all irrelevant to a data export.
export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('export-worker', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const exportsBucket = process.env.EXPORTS_BUCKET!;

  const buildService = (client: PoolClient): ExportWorkerService =>
    new ExportWorkerService(
      new DataRequestRepositoryAdapter(client),
      new ExportDataSourceAdapter(client),
      new S3FileStorageAdapter(REGION, uploadsBucket),
      new S3FileStorageAdapter(REGION, exportsBucket),
      new JsZipArchiverAdapter(),
    );

  const batchItemFailures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    const client = await pool.connect();
    // Declared outside the try so the catch can mark the row FAILED even when the failure
    // happens after parsing — a FAILED row is excluded from the 24h rate-limit window, so a
    // crashed export must not leave the tenant permanently locked out of retrying (§14).
    let message: ExportMessage | undefined;
    try {
      message = JSON.parse(record.body) as ExportMessage;
      const outcome = await withTenantTx(client, message.tenantId, () =>
        buildService(client).run(message!.requestId, message!.tenantId),
      );
      if (outcome) await notifyExportReady(client, message.tenantId, outcome.email, log);
    } catch (err) {
      log.error('export worker failed', { messageId: record.messageId, err: err instanceof Error ? err : new Error(String(err)) });
      if (message) await markFailedBestEffort(client, message, log);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};

// Best-effort: runs in its own transaction (the one from the failed attempt above was already
// rolled back by withTenantTx). A failure here must not mask the original error or block DLQ delivery.
async function markFailedBestEffort(client: PoolClient, message: ExportMessage, log: LambdaLogger): Promise<void> {
  try {
    await withTenantTx(client, message.tenantId, () =>
      new DataRequestRepositoryAdapter(client).markFailed(message.requestId),
    );
  } catch (err) {
    log.warn('failed to mark export request FAILED', { requestId: message.requestId, err: err instanceof Error ? err.message : String(err) });
  }
}

// Best-effort, post-commit: a notification failure must never fail or retry the message —
// the export itself already succeeded and is safely stored.
async function notifyExportReady(
  client: PoolClient,
  tenantId: string,
  email: string,
  log: LambdaLogger,
): Promise<void> {
  try {
    await buildPushNotifier(client).push(tenantId, 'Your data export is ready', 'Open the app to download it.');
  } catch (err) {
    log.warn('export-ready push failed', { tenantId, err: err instanceof Error ? err.message : String(err) });
  }
  try {
    await new SesEmailAdapter(REGION, process.env.SES_FROM_ADDRESS ?? 'noreply@wobblio.nl').sendExportReady(email);
  } catch (err) {
    log.warn('export-ready email failed', { tenantId, err: err instanceof Error ? err.message : String(err) });
  }
}
