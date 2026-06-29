import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID, createHash } from 'crypto';
import { Pool } from 'pg';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/identity/AppUserRepositoryAdapter';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import type { PoolClient } from 'pg';

const hashOf = (s: string) => createHash('sha256').update(s).digest('hex');

describe('Ingestion pipeline — Postgres end-to-end', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  // A user is its own tenant; RLS is set per transaction on a single client.
  const provisionTenant = async (): Promise<string> => {
    const sub = `sub-${randomUUID()}`;
    return new AppUserRepositoryAdapter(pool).insertUser(sub, `${sub}@test.nl`, 'ACTIVE');
  };

  const withTenant = async <T>(tenantId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await new TenantContextAdapter(client).setTenantId(tenantId);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  it('creates a pending invoice and finds it by hash within the tenant', async () => {
    const tenantId = await provisionTenant();
    const sha = hashOf(randomUUID());

    const found = await withTenant(tenantId, async (db) => {
      const repo = new InvoiceRepositoryAdapter(db);
      const id = await repo.createPending({
        tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
        imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
      });
      expect(id).toBeTruthy();
      return repo.findSameTenantByHash(sha);
    });

    expect(found?.imageSha256).toBe(sha);
    expect(found?.status).toBe('PROCESSING');
  });

  // NOTE: cross-tenant RLS *enforcement* cannot be verified here — the local dev
  // role owns the tables and Postgres bypasses RLS for owners (no FORCE RLS / no
  // dedicated app role locally). On AWS the Lambda connects as a non-owner app
  // role, so the `tenant_isolation` policies apply. This test instead asserts the
  // tenant-context plumbing runs without error against a freshly seeded tenant.
  it('sets tenant context and round-trips an invoice for the owning tenant', async () => {
    const tenantId = await provisionTenant();
    const sha = hashOf(randomUUID());

    const found = await withTenant(tenantId, async (db) => {
      const repo = new InvoiceRepositoryAdapter(db);
      await repo.createPending({
        tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
        imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
      });
      return repo.findSameTenantByHash(sha);
    });

    expect(found?.tenantId).toBe(tenantId);
  });

  it('claims the ingestion ledger once (ON CONFLICT DO NOTHING idempotency)', async () => {
    const tenantId = await provisionTenant();
    const s3Key = `receipts/${tenantId}/${hashOf(randomUUID())}.jpg`;

    const results = await withTenant(tenantId, async (db) => {
      const ledger = new IngestionLedgerAdapter(db);
      const first = await ledger.claim(s3Key, tenantId);
      const second = await ledger.claim(s3Key, tenantId);
      return { first, second };
    });

    expect(results.first).toBe(true);
    expect(results.second).toBe(false);
  });

  it('persists parsed invoice + lines and flips status to PARSED', async () => {
    const tenantId = await provisionTenant();
    const sha = hashOf(randomUUID());

    const status = await withTenant(tenantId, async (db) => {
      const repo = new InvoiceRepositoryAdapter(db);
      const invoiceId = await repo.createPending({
        tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
        imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
      });
      await repo.persistParsed({
        invoiceId, merchantId: null, merchantProvisional: false,
        transactionDate: '2026-06-10',
        currency: 'EUR', total: 4.0, categoryId: null, searchTags: ['weekly-groceries'],
        status: 'PARSED', priceEmissionBlocked: false,
        location: { countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'PROFILE' },
        lines: [{
          rawText: 'Melk', lineIndex: 0, productId: null, productProvisional: false, categoryId: null,
          quantity: 1, packQuantity: null,
          baseUnit: null, unitPrice: 4.0, normalizedUnitPrice: null, lineTotal: 4.0,
          isDiscount: false, isDepositOrFee: false, confidence: 0.9,
        }],
      });
      const record = await repo.getById(invoiceId);
      return record?.status;
    });

    expect(status).toBe('PARSED');
  });

  it('lists tenant invoices (newest first) and returns detail with lines', async () => {
    const tenantId = await provisionTenant();
    const sha = hashOf(randomUUID());

    const { list, detail } = await withTenant(tenantId, async (db) => {
      const repo = new InvoiceRepositoryAdapter(db);
      const invoiceId = await repo.createPending({
        tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
        imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
      });
      await repo.persistParsed({
        invoiceId, merchantId: null, merchantProvisional: false,
        transactionDate: '2026-06-10',
        currency: 'EUR', total: 5.0, categoryId: null, searchTags: ['weekly-groceries'],
        status: 'PARSED', priceEmissionBlocked: false,
        location: { countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'PROFILE' },
        lines: [{
          rawText: 'Melk', lineIndex: 0, productId: null, productProvisional: false, categoryId: null,
          quantity: 1, packQuantity: null,
          baseUnit: null, unitPrice: 5.0, normalizedUnitPrice: null, lineTotal: 5.0,
          isDiscount: false, isDepositOrFee: false, confidence: 0.9,
        }],
      });
      return { list: await repo.listForTenant(50), detail: await repo.getDetail(invoiceId) };
    });

    expect(list.some(i => i.searchTags.includes('weekly-groceries') && i.total === 5.0)).toBe(true);
    expect(detail?.lines).toHaveLength(1);
    expect(detail?.lines[0]).toMatchObject({ rawText: 'Melk', lineTotal: 5.0 });
    expect(detail?.imageS3Key).toContain(sha);
  });
});
