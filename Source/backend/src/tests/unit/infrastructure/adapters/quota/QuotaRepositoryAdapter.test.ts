import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { QuotaRepositoryAdapter } from '@infrastructure/adapters/quota/QuotaRepositoryAdapter';

describe('QuotaRepositoryAdapter', () => {
  let query: ReturnType<typeof vi.fn>;
  let repo: QuotaRepositoryAdapter;

  beforeEach(() => {
    query = vi.fn();
    repo = new QuotaRepositoryAdapter({ query } as unknown as PoolClient);
  });

  describe('getUsed', () => {
    it('returns used count from quota_counter', async () => {
      query.mockResolvedValue({ rows: [{ used: '5' }] });
      const result = await repo.getUsed('tenant-1', 'UPLOADS', '2026-06-24');
      expect(result).toBe(5);
    });

    it('returns 0 when no counter record exists', async () => {
      query.mockResolvedValue({ rows: [] });
      const result = await repo.getUsed('tenant-1', 'UPLOADS', '2026-06-24');
      expect(result).toBe(0);
    });
  });

  describe('increment', () => {
    it('increments the counter via INSERT ON CONFLICT', async () => {
      query.mockResolvedValue({ rowCount: 1 });
      await repo.increment('tenant-1', 'UPLOADS', '2026-06-24');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO quota_counter'),
        ['tenant-1', 'UPLOADS', '2026-06-24'],
      );
    });
  });

  describe('decrement', () => {
    it('decrements the counter, flooring at 0', async () => {
      query.mockResolvedValue({ rowCount: 1 });
      await repo.decrement('tenant-1', 'UPLOADS', '2026-06-24');

      const sql = query.mock.calls[0][0] as string;
      expect(sql).toContain('GREATEST(0, quota_counter.used - 1)');
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-1', 'UPLOADS', '2026-06-24'],
      );
    });

    it('creates a new counter row if none exists', async () => {
      query.mockResolvedValue({ rowCount: 1 });
      await repo.decrement('tenant-1', 'UPLOAD_FAILURE_REFUNDS', '2026-06-24');

      const sql = query.mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO quota_counter');
      expect(sql).toContain('ON CONFLICT');
    });
  });
});
