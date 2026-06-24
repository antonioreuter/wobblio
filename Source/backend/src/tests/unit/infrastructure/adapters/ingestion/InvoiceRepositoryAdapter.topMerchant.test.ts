import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';

// getTopMerchantsThisMonth aggregates globally and is tenant-scoped by RLS, so it
// cannot be isolated against the local owner-role DB (RLS bypassed). These mocked
// tests pin the SQL contract and row mapping deterministically instead.
describe('InvoiceRepositoryAdapter.getTopMerchantsThisMonth', () => {
  let query: ReturnType<typeof vi.fn>;
  let repo: InvoiceRepositoryAdapter;

  beforeEach(() => {
    query = vi.fn();
    repo = new InvoiceRepositoryAdapter({ query } as unknown as PoolClient);
  });

  it('maps rows to { name, total }[] with limit', async () => {
    query.mockResolvedValue({ rows: [
      { merchant_name: 'Albert Heijn', total: '128.40' },
      { merchant_name: 'Jumbo', total: '95.20' },
      { merchant_name: 'Lidl', total: '42.50' },
    ] });
    expect(await repo.getTopMerchantsThisMonth(3)).toEqual([
      { name: 'Albert Heijn', total: 128.4 },
      { name: 'Jumbo', total: 95.2 },
      { name: 'Lidl', total: 42.5 },
    ]);
  });

  it('returns empty array when the current month has no qualifying spend', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getTopMerchantsThisMonth(3)).toEqual([]);
  });

  it('filters discarded/null-total/null-merchant and ranks by current-month spend', async () => {
    query.mockResolvedValue({ rows: [] });
    await repo.getTopMerchantsThisMonth(3);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toMatch(/JOIN merchant m ON m\.id = i\.merchant_id/);
    expect(sql).toContain("i.status <> 'DISCARDED'");
    expect(sql).toContain('i.total IS NOT NULL');
    expect(sql).toContain("date_trunc('month', CURRENT_DATE)");
    expect(sql).toMatch(/ORDER BY SUM\(i\.total\) DESC/);
    expect(sql).toMatch(/LIMIT \$1/);
  });
});
