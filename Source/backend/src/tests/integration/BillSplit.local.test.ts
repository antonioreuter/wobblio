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

  it('creates a split, round-trips an encrypted assignment, updates on conflict, and removes it', async () => {
    const tenantId = await provisionTenant();

    const result = await withTenant(tenantId, async (db) => {
      const { invoiceId, lineId } = await seedInvoiceLine(db, tenantId);
      const splits = new BillSplitRepositoryAdapter(db);

      const splitId = await splits.create(invoiceId);
      const meta = await splits.getMeta(splitId);

      await splits.upsertAssignment(splitId, lineId, await enc.encrypt('Alice'), 0.5);
      const afterInsert = await splits.listAssignments(splitId);

      // ON CONFLICT (split_id, line_id) updates the same row rather than inserting a second.
      await splits.upsertAssignment(splitId, lineId, await enc.encrypt('Bob'), 1);
      const afterUpdate = await splits.listAssignments(splitId);

      await splits.removeAssignment(splitId, lineId);
      const afterRemove = await splits.listAssignments(splitId);

      return {
        meta, splitId, invoiceId,
        insertName: await enc.decrypt(afterInsert[0].participantNameEnc),
        insertFraction: afterInsert[0].fraction,
        updateCount: afterUpdate.length,
        updateName: await enc.decrypt(afterUpdate[0].participantNameEnc),
        updateFraction: afterUpdate[0].fraction,
        afterRemoveCount: afterRemove.length,
      };
    });

    expect(result.meta).toEqual({ id: result.splitId, invoiceId: result.invoiceId });
    expect(result.insertName).toBe('Alice');
    expect(result.insertFraction).toBe(0.5);
    expect(result.updateCount).toBe(1);
    expect(result.updateName).toBe('Bob');
    expect(result.updateFraction).toBe(1);
    expect(result.afterRemoveCount).toBe(0);
  });
});
