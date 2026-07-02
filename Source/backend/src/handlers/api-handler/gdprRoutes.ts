import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { DataRequestRepositoryAdapter } from '@infrastructure/adapters/gdpr/DataRequestRepositoryAdapter';
import { SqsExportQueueAdapter } from '@infrastructure/adapters/gdpr/SqsExportQueueAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { RequestExportService } from '@core/services/gdpr/RequestExportService';
import { ResolveExportDownloadService } from '@core/services/gdpr/ResolveExportDownloadService';
import { ExportRateLimitedError, DataRequestNotFoundError } from '@core/domain/errors';
import { REGION, json, withTenantTx } from './shared';

export async function handleGdprRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method === 'POST' && path === '/me/export') return handleRequestExport(db, user);
  if (method === 'GET' && path === '/me/export/latest') return handleLatestExport(db, user);

  const downloadMatch = path.match(/^\/me\/export\/([^/]+)\/download$/);
  if (method === 'GET' && downloadMatch) return handleExportDownload(db, user, downloadMatch[1]);

  return json(404, { message: 'Not Found' });
}

async function handleRequestExport(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  const exportQueueUrl = process.env.EXPORT_QUEUE_URL!;
  const service = new RequestExportService(
    new DataRequestRepositoryAdapter(db),
    new SqsExportQueueAdapter(REGION, exportQueueUrl),
  );

  try {
    const result = await withTenantTx(db, user.id, () => service.request(user.id));
    return json(202, result);
  } catch (err) {
    if (err instanceof ExportRateLimitedError) return json(429, { message: err.message });
    throw err;
  }
}

async function handleLatestExport(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  const request = await withTenantTx(db, user.id, () =>
    new DataRequestRepositoryAdapter(db).getLatestExport(user.id),
  );
  return json(200, { request });
}

async function handleExportDownload(
  db: PoolClient,
  user: AppUser,
  requestId: string,
): Promise<APIGatewayProxyResult> {
  const exportsBucket = process.env.EXPORTS_BUCKET!;
  const service = new ResolveExportDownloadService(
    new DataRequestRepositoryAdapter(db),
    new S3FileStorageAdapter(REGION, exportsBucket),
  );

  try {
    const result = await withTenantTx(db, user.id, () => service.resolve(requestId));
    return json(200, result);
  } catch (err) {
    if (err instanceof DataRequestNotFoundError) return json(404, { message: 'Export request not found' });
    throw err;
  }
}
