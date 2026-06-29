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
      query.mockResolvedValue({ rows: [{ used: '8500' }] });
      const result = await repo.getUsed('tenant-1', 'CREDITS', '2026-06-24');
      expect(result).toBe(8500);
    });

    it('returns 0 when no counter record exists', async () => {
      query.mockResolvedValue({ rows: [] });
      const result = await repo.getUsed('tenant-1', 'CREDITS', '2026-06-24');
      expect(result).toBe(0);
    });
  });

  describe('increment', () => {
    it('adds the amount via INSERT ON CONFLICT (server-side, atomic)', async () => {
      query.mockResolvedValue({ rowCount: 1 });
      await repo.increment('tenant-1', 'CREDITS', '2026-06-24', 8500);

      const sql = query.mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO quota_counter');
      expect(sql).toContain('quota_counter.used + $4');
      expect(query).toHaveBeenCalledWith(expect.any(String), ['tenant-1', 'CREDITS', '2026-06-24', 8500]);
    });
  });

  describe('decrement', () => {
    it('subtracts the amount, flooring at 0', async () => {
      query.mockResolvedValue({ rowCount: 1 });
      await repo.decrement('hh-1', 'HOUSEHOLD_CREDITS', '2026-06-24', 10000);

      const sql = query.mock.calls[0][0] as string;
      expect(sql).toContain('GREATEST(0, quota_counter.used - $4)');
      expect(query).toHaveBeenCalledWith(expect.any(String), ['hh-1', 'HOUSEHOLD_CREDITS', '2026-06-24', 10000]);
    });

    it('creates a new counter row if none exists', async () => {
      query.mockResolvedValue({ rowCount: 1 });
      await repo.decrement('tenant-1', 'CREDITS', '2026-06-24', 5000);

      const sql = query.mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO quota_counter');
      expect(sql).toContain('ON CONFLICT');
    });
  });
});
