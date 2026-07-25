import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';

// The stage a client renders is derived in SQL (fix 07/01), so the CASE/COALESCE and the join are
// the contract worth pinning: RLS-scoped reads cannot be isolated against the local owner-role DB.
describe('InvoiceRepositoryAdapter processing stage', () => {
  let query: ReturnType<typeof vi.fn>;
  let repo: InvoiceRepositoryAdapter;

  const sqlOf = (call = 0) => query.mock.calls[call][0] as string;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [] });
    repo = new InvoiceRepositoryAdapter({ query } as unknown as PoolClient);
  });

  describe('listForTenant', () => {
    it('derives the stage from the progress row, defaulting an untouched invoice to RECEIVED', async () => {
      await repo.listForTenant(100);

      const sql = sqlOf();
      expect(sql).toContain('LEFT JOIN invoice_processing_progress p ON p.invoice_id = i.id');
      // COALESCE, not a written row: an enqueued-but-unstarted invoice is RECEIVED by definition,
      // so the confirm path stays free of an extra INSERT.
      expect(sql).toContain("CASE WHEN i.status = 'PROCESSING' THEN COALESCE(p.stage, 'RECEIVED') END AS processing_stage");
    });

    it('is a LEFT join so an invoice with no progress row still appears in the list', async () => {
      query.mockResolvedValue({ rows: [listRow({ status: 'PROCESSING', processing_stage: 'RECEIVED' })] });

      const [item] = await repo.listForTenant(100);

      expect(item.processingStage).toBe('RECEIVED');
    });

    it('carries a null stage for a terminal invoice', async () => {
      query.mockResolvedValue({ rows: [listRow({ status: 'PARSED', processing_stage: null })] });

      const [item] = await repo.listForTenant(100);

      expect(item.processingStage).toBeNull();
      expect(item.status).toBe('PARSED');
    });
  });

  describe('listStatuses', () => {
    it('short-circuits an empty id list without touching the database', async () => {
      expect(await repo.listStatuses([])).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('reads only id/status/stage/updated_at — no merchant join, no line bloat', async () => {
      await repo.listStatuses(['inv-1', 'inv-2']);

      const sql = sqlOf();
      expect(sql).toContain('SELECT i.id, i.status');
      expect(sql).toContain('WHERE i.id = ANY($1::uuid[])');
      expect(sql).not.toContain('merchant');
      expect(sql).not.toContain('invoice_line');
      expect(query).toHaveBeenCalledWith(expect.any(String), [['inv-1', 'inv-2']]);
    });

    it('maps rows to the client status DTO', async () => {
      query.mockResolvedValue({ rows: [
        { id: 'inv-1', status: 'PROCESSING', processing_stage: 'MATCHING', updated_at: '2026-07-24T09:00:03Z' },
        { id: 'inv-2', status: 'PARSED', processing_stage: null, updated_at: null },
      ] });

      expect(await repo.listStatuses(['inv-1', 'inv-2'])).toEqual([
        { id: 'inv-1', status: 'PROCESSING', processingStage: 'MATCHING', updatedAt: '2026-07-24T09:00:03Z' },
        { id: 'inv-2', status: 'PARSED', processingStage: null, updatedAt: null },
      ]);
    });

    it('omits ids the tenant cannot see rather than erroring — RLS filters, no existence oracle', async () => {
      query.mockResolvedValue({ rows: [
        { id: 'mine', status: 'PROCESSING', processing_stage: 'READING', updated_at: '2026-07-24T09:00:01Z' },
      ] });

      const result = await repo.listStatuses(['mine', 'someone-elses']);

      expect(result.map((r) => r.id)).toEqual(['mine']);
    });
  });
});

function listRow(overrides: Record<string, unknown>) {
  return {
    id: 'inv-1',
    status: 'PROCESSING',
    merchant_name: 'Albert Heijn',
    category_id: 'cat-groceries',
    transaction_date: '2026-07-24',
    total: '12.50',
    currency: 'EUR',
    total_home_currency: '12.50',
    search_tags: [],
    search_city: null,
    created_at: '2026-07-24T09:00:00Z',
    location_status: 'RESOLVED',
    location_country_code: 'NL',
    location_region_code: 'NL-NB',
    processing_stage: null,
    ...overrides,
  };
}
