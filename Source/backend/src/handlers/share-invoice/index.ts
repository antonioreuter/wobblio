import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { InvoiceShareRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceShareRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { SecureTokenAdapter } from '@infrastructure/adapters/security/SecureTokenAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { ShareInvoiceService } from '@core/services/ingestion/ShareInvoiceService';
import { InvalidShareError } from '@core/domain/errors';
import { REGION, json, withTenantTx } from '../api-handler/shared';

// Public, unauthenticated resolver for a shared receipt. The {token} in the URL is
// the only credential (an unguessable 256-bit value); the invoice id is never
// exposed. resolve_invoice_share crosses RLS to find the target invoice + its tenant,
// then the detail read runs under that tenant's RLS scope — so a token only ever
// exposes its one invoice, nothing else.
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLambdaLogger('share-invoice', context.awsRequestId);

  const token = event.pathParameters?.token ?? '';
  if (!token) return json(400, { message: 'Missing share token' });

  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
  );
  const client = await pool.connect();
  try {
    const service = new ShareInvoiceService(
      new InvoiceRepositoryAdapter(client),
      new InvoiceShareRepositoryAdapter(client),
      new SecureTokenAdapter(),
      buildKmsEncryption(REGION),
    );

    const { invoiceId, tenantId } = await service.resolveShare(token);

    const detail = await withTenantTx(client, tenantId, () =>
      new InvoiceRepositoryAdapter(client).getDetail(invoiceId),
    );
    if (!detail) return json(404, { message: 'Shared receipt not found' });

    const uploadsBucket = process.env.UPLOADS_BUCKET!;
    const imageUrl = await new S3FileStorageAdapter(REGION, uploadsBucket).presignGet(detail.imageS3Key, 300);

    log.info('shared invoice resolved', { invoiceId });
    return json(200, {
      merchant: detail.merchantName,
      date: detail.transactionDate,
      total: detail.total,
      currency: detail.currency,
      lines: detail.lines,
      imageUrl,
    });
  } catch (err) {
    if (err instanceof InvalidShareError) return json(404, { message: 'This share link is invalid or has expired' });
    throw err;
  } finally {
    client.release();
  }
};
