import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeUserCounterAdapter } from '@infrastructure/adapters/waitlist/FreeUserCounterAdapter';
import type { Pool } from 'pg';

describe('FreeUserCounterAdapter', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let adapter: FreeUserCounterAdapter;

  beforeEach(() => {
    mockPool = { query: vi.fn() };
    adapter = new FreeUserCounterAdapter(mockPool as unknown as Pool);
  });

  describe('tryClaimSlot', () => {
    it('returns true when the UPDATE affects one row (slot claimed)', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1, rows: [{ value: '1' }] });

      const result = await adapter.tryClaimSlot(100);

      expect(result).toBe(true);
    });

    it('returns false when the UPDATE affects zero rows (cap reached)', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0, rows: [] });

      const result = await adapter.tryClaimSlot(100);

      expect(result).toBe(false);
    });

    it('uses correct SQL with conditional cap check', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1, rows: [{ value: '5' }] });

      await adapter.tryClaimSlot(50);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND value < $2'),
        ['free_user_count', 50],
      );
    });
  });

  describe('getCurrentCount', () => {
    it('returns the current counter value', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ value: '42' }] });

      const count = await adapter.getCurrentCount();

      expect(count).toBe(42);
    });

    it('returns 0 when no row exists', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const count = await adapter.getCurrentCount();

      expect(count).toBe(0);
    });
  });
});
