import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WaitlistStatusDbAdapter } from '@infrastructure/adapters/WaitlistStatusDbAdapter';
import type { Pool } from 'pg';

describe('WaitlistStatusDbAdapter', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let adapter: WaitlistStatusDbAdapter;

  beforeEach(() => {
    mockPool = { query: vi.fn() };
    adapter = new WaitlistStatusDbAdapter(mockPool as unknown as Pool, 5000);
  });

  it('reads the free_user_count counter, not waitlist_count', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ value: '0' }] });

    await adapter.isWaitlistActive();

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT value FROM system_counter WHERE name = $1',
      ['free_user_count'],
    );
  });

  it('is inactive while free users are below the cap', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ value: '4999' }] });

    expect(await adapter.isWaitlistActive()).toBe(false);
  });

  it('is active once free users reach the cap', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ value: '5000' }] });

    expect(await adapter.isWaitlistActive()).toBe(true);
  });

  it('defaults to inactive when the counter row is missing', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    expect(await adapter.isWaitlistActive()).toBe(false);
  });
});
