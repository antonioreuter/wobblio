import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'crypto';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/identity/AppUserRepositoryAdapter';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { BillSplitRepositoryAdapter } from '@infrastructure/adapters/splitting/BillSplitRepositoryAdapter';
import { LocalEncryptionAdapter } from '@infrastructure/adapters/security/LocalEncryptionAdapter';

const hashOf = (s: string) => createHash('sha256').update(s).digest('hex');

describe('BillSplitRepositoryAdapter — Postgres + encryption round-trip', () => {
  let pool: Pool;
  const enc = new LocalEncryptionAdapter('bill-split-test-secret');

  beforeAll(() => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

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

  const seedInvoiceLine = async (db: PoolClient, tenantId: string): Promise<{ invoiceId: string; lineId: string }> => {
    const repo = new InvoiceRepositoryAdapter(db);
    const sha = hashOf(randomUUID());
    const invoiceId = await repo.createPending({
      tenantId, uploadedByUserId: tenantId, householdId: null, quotaPooled: false,
      imageS3Key: `receipts/${tenantId}/${sha}.jpg`, imageSha256: sha,
    });
    await repo.persistParsed({
      invoiceId, merchantId: null, merchantProvisional: false,
      transactionDate: '2026-06-10', currency: 'EUR', total: 10, totalHomeCurrency: 10, fxRateUsed: 1,
      categoryId: null, searchTags: [], searchCity: null, status: 'PARSED', priceEmissionBlocked: false,
      location: { countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'PROFILE' },
      lines: [{
        rawText: 'Pizza', lineIndex: 0, productId: null, productProvisional: false, categoryId: null,
        quantity: 2, packQuantity: null, baseUnit: null, unitPrice: 5, normalizedUnitPrice: null,
        lineTotal: 10, isDiscount: false, isDepositOrFee: false, confidence: 0.9,
      }],
    });
    const detail = await repo.getDetail(invoiceId);
    return { invoiceId, lineId: detail!.lines[0].id };
  };

  it('creates a split, round-trips multi-participant encrypted allocations, replaces the set, and clears it', async () => {
    const tenantId = await provisionTenant();

    const result = await withTenant(tenantId, async (db) => {
      const { invoiceId, lineId } = await seedInvoiceLine(db, tenantId); // line quantity 2

      const splits = new BillSplitRepositoryAdapter(db);
      const splitId = await splits.create(invoiceId);
      const meta = await splits.getMeta(splitId);

      // Two people on one line: 1 unit each.
      await splits.setLineAllocations(splitId, lineId, [
        { participantNameEnc: await enc.encrypt('Alice'), units: 1 },
        { participantNameEnc: await enc.encrypt('Bob'), units: 1 },
      ]);
      const afterInsert = await splits.listAllocations(splitId);

      // Replacing the set wholesale swaps both rows atomically.
      await splits.setLineAllocations(splitId, lineId, [
        { participantNameEnc: await enc.encrypt('Carol'), units: 2 },
      ]);
      const afterReplace = await splits.listAllocations(splitId);

      await splits.setLineAllocations(splitId, lineId, []);
      const afterClear = await splits.listAllocations(splitId);

      return {
        meta, splitId, invoiceId,
        insertCount: afterInsert.length,
        insertNames: (await Promise.all(afterInsert.map((a) => enc.decrypt(a.participantNameEnc)))).sort(),
        replaceCount: afterReplace.length,
        replaceName: await enc.decrypt(afterReplace[0].participantNameEnc),
        replaceUnits: afterReplace[0].units,
        afterClearCount: afterClear.length,
      };
    });

    expect(result.meta).toEqual({ id: result.splitId, invoiceId: result.invoiceId });
    expect(result.insertCount).toBe(2);
    expect(result.insertNames).toEqual(['Alice', 'Bob']);
    expect(result.replaceCount).toBe(1);
    expect(result.replaceName).toBe('Carol');
    expect(result.replaceUnits).toBe(2);
    expect(result.afterClearCount).toBe(0);
  });
});
