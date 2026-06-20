import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';

// getTopMerchantThisMonth aggregates globally and is tenant-scoped by RLS, so it
// cannot be isolated against the local owner-role DB (RLS bypassed). These mocked
// tests pin the SQL contract and row mapping deterministically instead.
describe('InvoiceRepositoryAdapter.getTopMerchantThisMonth', () => {
  let query: ReturnType<typeof vi.fn>;
  let repo: InvoiceRepositoryAdapter;

  beforeEach(() => {
    query = vi.fn();
    repo = new InvoiceRepositoryAdapter({ query } as unknown as PoolClient);
  });

  it('maps the winning row to { name, total }', async () => {
    query.mockResolvedValue({ rows: [{ merchant_name: 'Albert Heijn', total: '128.40' }] });
    expect(await repo.getTopMerchantThisMonth()).toEqual({ name: 'Albert Heijn', total: 128.4 });
  });

  it('returns null when the current month has no qualifying spend', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getTopMerchantThisMonth()).toBeNull();
  });

  it('filters discarded/null-total/null-merchant and ranks by current-month spend', async () => {
    query.mockResolvedValue({ rows: [] });
    await repo.getTopMerchantThisMonth();

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toMatch(/JOIN merchant m ON m\.id = i\.merchant_id/);
    expect(sql).toContain("i.status <> 'DISCARDED'");
    expect(sql).toContain('i.total IS NOT NULL');
    expect(sql).toContain("date_trunc('month', CURRENT_DATE)");
    expect(sql).toMatch(/ORDER BY SUM\(i\.total\) DESC/);
    expect(sql).toMatch(/LIMIT 1/);
  });
});
