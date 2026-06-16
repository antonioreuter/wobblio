import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiSpendLedgerAdapter } from '@infrastructure/adapters/ai/AiSpendLedgerAdapter';
import type { Pool } from 'pg';

describe('AiSpendLedgerAdapter', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let adapter: AiSpendLedgerAdapter;

  beforeEach(() => {
    mockPool = { query: vi.fn() };
    adapter = new AiSpendLedgerAdapter(mockPool as unknown as Pool);
  });

  describe('record', () => {
    it('inserts a spend record with correct SQL parameter order', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await adapter.record({
        tenantId: 't-1',
        date: '2026-06-11',
        modelRole: 'VISION_PARSE',
        inputTokens: 100,
        outputTokens: 50,
        estCost: 0.00006,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_spend_ledger'),
        ['t-1', '2026-06-11', 'VISION_PARSE', 100, 50, 0.00006],
      );
    });
  });

  describe('getDailyTotal', () => {
    it('returns 0 when no rows exist for the tenant and date', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ total: null }] });

      const total = await adapter.getDailyTotal('t-1', '2026-06-11');

      expect(total).toBe(0);
    });

    it('returns the sum as a float when rows exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ total: '0.07500' }] });

      const total = await adapter.getDailyTotal('t-1', '2026-06-11');

      expect(total).toBeCloseTo(0.075);
    });

    it('queries by tenantId and date', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ total: '0.00' }] });

      await adapter.getDailyTotal('t-42', '2026-06-11');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        ['t-42', '2026-06-11'],
      );
    });
  });
});
