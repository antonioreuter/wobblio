import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { BillSplitRepositoryAdapter } from '@infrastructure/adapters/splitting/BillSplitRepositoryAdapter';
import { BillSplitShareRepositoryAdapter } from '@infrastructure/adapters/splitting/BillSplitShareRepositoryAdapter';
import { SecureTokenAdapter } from '@infrastructure/adapters/security/SecureTokenAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { BillSplitService } from '@core/services/splitting/BillSplitService';
import { ShareBillSplitService } from '@core/services/splitting/ShareBillSplitService';
import { InvalidShareError } from '@core/domain/errors';
import { REGION, json, withTenantTx } from '../api-handler/shared';

// Public, unauthenticated resolver for a shared bill split. The {token} in the URL is
// the only credential (an unguessable 256-bit value); the split id is never exposed.
// resolve_bill_split_share crosses RLS to find the target split + its tenant, then the
// summary read runs under that tenant's RLS scope — so a token only ever exposes its
// one split's per-person breakdown, nothing else.
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLambdaLogger('share-bill-split', context.awsRequestId);

  const token = event.pathParameters?.token ?? '';
  if (!token) return json(400, { message: 'Missing share token' });

  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
  );
  const client = await pool.connect();
  try {
    const shareService = new ShareBillSplitService(
      new BillSplitRepositoryAdapter(client),
      new BillSplitShareRepositoryAdapter(client),
      new SecureTokenAdapter(),
      buildKmsEncryption(REGION),
    );

    const { splitId, tenantId } = await shareService.resolveShare(token);

    const view = await withTenantTx(client, tenantId, () =>
      new BillSplitService(
        new InvoiceRepositoryAdapter(client),
        new BillSplitRepositoryAdapter(client),
        buildKmsEncryption(REGION),
      ).sharedSummary(splitId),
    );

    log.info('shared bill split resolved', { splitId });
    return json(200, {
      merchant: view.merchant,
      date: view.date,
      currency: view.currency,
      participants: view.summary.participants,
      grandTotal: view.summary.grandTotal,
    });
  } catch (err) {
    if (err instanceof InvalidShareError) return json(404, { message: 'This share link is invalid or has expired' });
    throw err;
  } finally {
    client.release();
  }
};
