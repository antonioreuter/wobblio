import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID, createHash } from 'crypto';
import { Pool } from 'pg';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/identity/AppUserRepositoryAdapter';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import { FxRateRepositoryAdapter } from '@infrastructure/adapters/fx/FxRateRepositoryAdapter';
import { CurrencyHarmonizationService } from '@core/services/fx/CurrencyHarmonizationService';
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
    await pool.query(`DELETE FROM fx_rate WHERE quote IN ('USD', 'GBP')`);
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
        currency: 'EUR', total: 4.0, totalHomeCurrency: 4.0, fxRateUsed: 1,
        categoryId: null, searchTags: ['weekly-groceries'],
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
        currency: 'EUR', total: 5.0, totalHomeCurrency: 5.0, fxRateUsed: 1,
        categoryId: null, searchTags: ['weekly-groceries'],
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

  // §03.7 reprocess-on-behalf re-runs the whole pipeline against an invoice that already
  // carries a committed set of lines, so persistParsed must REPLACE them, not append. Appending
  // showed every item twice in the drawer and skewed findFuzzyDuplicate's line-count fingerprint.
  it('replaces the existing lines when the same invoice is persisted twice', async () => {
    const tenantId = await provisionTenant();
    const sha = hashOf(randomUUID());

    const parsed = (invoiceId: string) => ({
      invoiceId, merchantId: null, merchantProvisional: false,
      transactionDate: '2026-06-10',
      currency: 'EUR', total: 7.5, totalHomeCurrency: 7.5, fxRateUsed: 1,
      categoryId: null, searchTags: ['weekly-groceries'], searchCity: null,
      status: 'PARSED' as const, priceEmissionBlocked: false,
      location: { countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED' as const, source: 'PROFILE' as const },
      lines: [
        {
          rawText: 'Melk', lineIndex: 0, productId: null, productProvisional: false, categoryId: null,
          quantity: 1, packQuantity: null, baseUnit: null, sizeSource: null,
          unitPrice: 2.5, lineTotal: 2.5, isDiscount: false, isDepositOrFee: false, confidence: 0.9,
        },
        {
          rawText: 'Brood', lineIndex: 1, productId: null, productProvisional: false, categoryId: null,
          quantity: 1, packQuantity: null, baseUnit: null, sizeSource: null,
          unitPrice: 5.0, lineTotal: 5.0, isDiscount: false, isDepositOrFee: false, confidence: 0.9,
        },
      ],
    });

    const detail = await withTenant(tenantId, async (db) => {
      const repo = new InvoiceRepositoryAdapter(db);
      const invoiceId = await repo.createPending({
        tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
        imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
      });
      await repo.persistParsed(parsed(invoiceId));
      await repo.persistParsed(parsed(invoiceId)); // the reprocess run
      return repo.getDetail(invoiceId);
    });

    expect(detail?.lines).toHaveLength(2);
    expect(detail?.lines.map(l => l.rawText)).toEqual(['Melk', 'Brood']);
  });

  // bill_split_line FKs invoice_line(id) with no ON DELETE CASCADE. Without clearing the
  // allocations first the reprocess delete raises 23503, which the worker treats as a
  // non-retryable constraint violation and re-quarantines the invoice.
  it('clears bill-split allocations pointing at the replaced lines', async () => {
    const tenantId = await provisionTenant();
    const sha = hashOf(randomUUID());

    const line = {
      rawText: 'Melk', lineIndex: 0, productId: null, productProvisional: false, categoryId: null,
      quantity: 1, packQuantity: null, baseUnit: null, sizeSource: null,
      unitPrice: 2.5, lineTotal: 2.5, isDiscount: false, isDepositOrFee: false, confidence: 0.9,
    };
    const parsed = (invoiceId: string) => ({
      invoiceId, merchantId: null, merchantProvisional: false,
      transactionDate: '2026-06-10',
      currency: 'EUR', total: 2.5, totalHomeCurrency: 2.5, fxRateUsed: 1,
      categoryId: null, searchTags: ['weekly-groceries'], searchCity: null,
      status: 'PARSED' as const, priceEmissionBlocked: false,
      location: { countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED' as const, source: 'PROFILE' as const },
      lines: [line],
    });

    const result = await withTenant(tenantId, async (db) => {
      const repo = new InvoiceRepositoryAdapter(db);
      const invoiceId = await repo.createPending({
        tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
        imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
      });
      await repo.persistParsed(parsed(invoiceId));

      const lineId = (await db.query<{ id: string }>(
        `SELECT id FROM invoice_line WHERE invoice_id = $1`, [invoiceId],
      )).rows[0].id;
      const splitId = (await db.query<{ id: string }>(
        `INSERT INTO bill_split (invoice_id) VALUES ($1) RETURNING id`, [invoiceId],
      )).rows[0].id;
      await db.query(
        `INSERT INTO bill_split_line (split_id, line_id, participant_name_enc, units)
         VALUES ($1, $2, 'enc', 1)`,
        [splitId, lineId],
      );

      await repo.persistParsed(parsed(invoiceId)); // the reprocess run — must not raise 23503

      const allocations = await db.query(`SELECT 1 FROM bill_split_line WHERE split_id = $1`, [splitId]);
      return { detail: await repo.getDetail(invoiceId), allocations: allocations.rowCount };
    });

    expect(result.detail?.lines).toHaveLength(1);
    expect(result.allocations).toBe(0);
  });

  // §11 FX end-to-end: a non-EUR receipt for a EUR-home user must persist a harmonized
  // total_home_currency + fx_rate_used, crossed via the transaction-date ECB rate. This
  // exercises the real FxRateRepositoryAdapter + CurrencyHarmonizationService that both
  // pipelines run inside InvoiceFinalizer, then reads the columns straight from Postgres.
  it('harmonizes a non-EUR invoice total into the home currency at the transaction-date rate', async () => {
    const txDate = '2026-06-15';
    const fxRepo = new FxRateRepositoryAdapter(pool);
    // 1 EUR = 1.08 USD, 1 EUR = 0.85 GBP on the transaction date.
    await fxRepo.upsertDaily(txDate, 'EUR', [{ quote: 'USD', rate: 1.08 }, { quote: 'GBP', rate: 0.85 }]);

    const harmonizer = new CurrencyHarmonizationService(fxRepo);
    // USD receipt, EUR home: fxRateUsed = rate(EUR→EUR) / rate(EUR→USD) = 1 / 1.08.
    const eurHome = await harmonizer.harmonize(21.6, 'USD', 'EUR', txDate);
    expect(eurHome.fxRateUsed).toBeCloseTo(1 / 1.08, 8);
    expect(eurHome.totalHomeCurrency).toBeCloseTo(20.0, 2);

    // USD receipt, GBP home crosses via EUR: rate(EUR→GBP) / rate(EUR→USD) = 0.85 / 1.08.
    const gbpHome = await harmonizer.harmonize(21.6, 'USD', 'GBP', txDate);
    expect(gbpHome.fxRateUsed).toBeCloseTo(0.85 / 1.08, 8);
    expect(gbpHome.totalHomeCurrency).toBeCloseTo(17.0, 2);

    const tenantId = await provisionTenant();
    const sha = hashOf(randomUUID());
    const persisted = await withTenant(tenantId, async (db) => {
      const repo = new InvoiceRepositoryAdapter(db);
      const invoiceId = await repo.createPending({
        tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
        imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
      });
      await repo.persistParsed({
        invoiceId, merchantId: null, merchantProvisional: false,
        transactionDate: txDate,
        currency: 'USD', total: 21.6,
        totalHomeCurrency: eurHome.totalHomeCurrency, fxRateUsed: eurHome.fxRateUsed,
        categoryId: null, searchTags: ['travel'],
        status: 'PARSED', priceEmissionBlocked: false,
        location: { countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'PROFILE' },
        lines: [{
          rawText: 'Coffee', lineIndex: 0, productId: null, productProvisional: false, categoryId: null,
          quantity: 1, packQuantity: null,
          baseUnit: null, unitPrice: 21.6, normalizedUnitPrice: null, lineTotal: 21.6,
          isDiscount: false, isDepositOrFee: false, confidence: 0.9,
        }],
      });
      const row = await db.query<{ total_home_currency: string | null; fx_rate_used: string | null }>(
        `SELECT total_home_currency, fx_rate_used FROM invoice WHERE id = $1`,
        [invoiceId],
      );
      return row.rows[0];
    });

    expect(persisted?.total_home_currency).not.toBeNull();
    expect(Number(persisted?.total_home_currency)).toBeCloseTo(20.0, 2);
    expect(Number(persisted?.fx_rate_used)).toBeCloseTo(1 / 1.08, 8);
  });
});
