import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { FaultAdminRepositoryAdapter } from '@infrastructure/adapters/ingestion/FaultAdminRepositoryAdapter';
import { SqsIngestionQueueAdapter } from '@infrastructure/adapters/ingestion/SqsIngestionQueueAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { NotificationRepositoryAdapter } from '@infrastructure/adapters/notifications/NotificationRepositoryAdapter';
import { MockPushAdapter } from '@infrastructure/adapters/notifications/MockPushAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { JsZipArchiverAdapter } from '@infrastructure/adapters/admin/JsZipArchiverAdapter';
import { SsmSystemFaultLimitsAdapter } from '@infrastructure/adapters/quota/SsmSystemFaultLimitsAdapter';
import { AdminFaultService } from '@core/services/admin/AdminFaultService';
import { AdminDebugSampleService } from '@core/services/admin/AdminDebugSampleService';
import { REGION, json, parseJsonBody } from './shared';

// Operator reprocess-on-behalf for system-fault-quarantined invoices (§07). ADMIN-gated by
// handleAdminRoute; mutations are audited via AdminAuditLogAdapter inside the service.
export async function handleAdminFaultRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = buildService(db);
  const actor = { id: user.id, email: user.email };

  if (method === 'GET' && path === '/admin/faults') {
    return json(200, await service.listBlocked());
  }

  // §08 debug-sample — GDPR SHIP-BLOCKED (DPO/counsel sign-off + ToS clause required) and so
  // OFF unless DEBUG_SAMPLE_ENABLED=true is set explicitly post-sign-off. Egresses opaque
  // image bytes for one root cause; never enable without the documented legal review.
  if (method === 'GET' && path === '/admin/faults/sample.zip') {
    if (process.env.DEBUG_SAMPLE_ENABLED !== 'true') {
      return json(403, { message: 'Debug-sample endpoint is disabled (pending GDPR sign-off)' });
    }
    const reason = (event.queryStringParameters?.reason ?? '').trim();
    if (!reason) return json(400, { message: 'reason query param required' });
    const { zip, count } = await buildDebugSampleService(db).buildSample(actor, reason);
    log.info('admin fault debug-sample', { actorId: user.id, count });
    return json(200, { filename: 'sample.zip', count, zipBase64: Buffer.from(zip).toString('base64') });
  }

  if (method === 'POST' && path === '/admin/faults/reprocess') {
    const body = parseJsonBody(event.body);
    const invoiceIds = Array.isArray(body.invoiceIds) ? body.invoiceIds.filter((id): id is string => typeof id === 'string') : [];
    if (invoiceIds.length === 0) return json(400, { message: 'invoiceIds must be a non-empty array' });
    const result = await service.reprocess(actor, invoiceIds);
    log.info('admin fault reprocess', { actorId: user.id, ...result });
    return json(200, result);
  }

  const wontProcessMatch = path.match(/^\/admin\/faults\/([^/]+)\/wont-process$/);
  if (method === 'POST' && wontProcessMatch) {
    const result = await service.wontProcess(actor, wontProcessMatch[1]);
    if (!result.demoted) return json(404, { message: 'Invoice not found or no longer blocked' });
    log.info('admin fault wont-process', { actorId: user.id, invoiceId: wontProcessMatch[1] });
    return json(200, result);
  }

  return json(404, { message: 'Not Found' });
}

function buildService(db: PoolClient): AdminFaultService {
  return new AdminFaultService(
    new FaultAdminRepositoryAdapter(db),
    new SqsIngestionQueueAdapter(REGION, process.env.INGEST_QUEUE_URL!),
    new NotificationRepositoryAdapter(db),
    new MockPushAdapter(),
    new AdminAuditLogAdapter(db),
    new SsmSystemFaultLimitsAdapter(REGION),
  );
}

function buildDebugSampleService(db: PoolClient): AdminDebugSampleService {
  return new AdminDebugSampleService(
    new FaultAdminRepositoryAdapter(db),
    new S3FileStorageAdapter(REGION, process.env.UPLOADS_BUCKET!),
    new JsZipArchiverAdapter(),
    new AdminAuditLogAdapter(db),
  );
}
