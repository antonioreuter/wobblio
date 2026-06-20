import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { ReleasableHeldInvoiceReaderAdapter } from '@infrastructure/adapters/ingestion/ReleasableHeldInvoiceReaderAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { HeldInvoiceReleaseService } from '@core/services/ingestion/HeldInvoiceReleaseService';

const RELEASE_BATCH = 200;

// Re-emits price observations for HELD_UNMAPPED invoices whose region has since been
// mapped to reference data, then flips them to RESOLVED (§6.5 release path). Discovery
// is cross-tenant (SECURITY DEFINER); each invoice is then processed in its own
// tenant-scoped transaction so RLS reads/writes resolve to the owning tenant.
export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-release-held-locations', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!, 30000);

  const client = await pool.connect();
  try {
    const candidates = await new ReleasableHeldInvoiceReaderAdapter(client).listReleasable(RELEASE_BATCH);

    let released = 0;
    for (const candidate of candidates) {
      try {
        await client.query('BEGIN');
        await new TenantContextAdapter(client).setTenantId(candidate.tenantId);
        const service = new HeldInvoiceReleaseService(
          new InvoiceRepositoryAdapter(client),
          new ContributorContextRepositoryAdapter(client),
          new PriceObservationStoreAdapter(client),
        );
        const emitted = await service.releaseInvoice(candidate);
        await client.query('COMMIT');
        if (emitted) released += 1;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        log.error('held release failed', {
          invoiceId: candidate.invoiceId,
          err: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    log.info('held location release complete', { candidates: candidates.length, released });
  } finally {
    client.release();
  }
};
