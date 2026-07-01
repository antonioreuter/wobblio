import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { FxRateRepositoryAdapter } from '@infrastructure/adapters/fx/FxRateRepositoryAdapter';

// fx_rate is a global, RLS-exempt reference table — no tenant context needed.
describe('FxRateRepositoryAdapter — Postgres', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM fx_rate WHERE quote IN ('ZAR', 'ZWX')`);
    await pool.end();
  });

  it('upserts EUR-base rates idempotently and updates the rate on conflict', async () => {
    const repo = new FxRateRepositoryAdapter(pool);

    const first = await repo.upsertDaily('2026-06-28', 'EUR', [{ quote: 'ZAR', rate: 19.5 }]);
    expect(first).toBe(1);

    await repo.upsertDaily('2026-06-28', 'EUR', [{ quote: 'ZAR', rate: 20.1 }]);
    const rate = await repo.latestOnOrBefore('ZAR', '2026-06-28');
    expect(rate).toBe(20.1);
  });

  it('falls back to the latest strictly-prior date when the exact date is absent', async () => {
    const repo = new FxRateRepositoryAdapter(pool);
    await repo.upsertDaily('2026-06-20', 'EUR', [{ quote: 'ZWX', rate: 3.3 }]);
    await repo.upsertDaily('2026-06-22', 'EUR', [{ quote: 'ZWX', rate: 3.7 }]);

    // No row on the 25th → latest on-or-before returns the 22nd's rate.
    expect(await repo.latestOnOrBefore('ZWX', '2026-06-25')).toBe(3.7);
    // EUR resolves to 1 without a query; an unknown currency returns null.
    expect(await repo.latestOnOrBefore('EUR', '2026-06-25')).toBe(1);
    expect(await repo.latestOnOrBefore('XXX', '2026-06-25')).toBeNull();
  });
});
