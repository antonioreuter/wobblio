import { describe, it, expect, vi } from 'vitest'
import { GET } from './route';
import * as db from '@/lib/db';

vi.mock('@/lib/db');

const FREE_CAP = 5;

describe('GET /api/waitlist/status', () => {
  it('returns waitlistActive: false when count is below cap', async () => {
    vi.mocked(db.getFreeUserCount).mockResolvedValue(FREE_CAP - 1);
    const res = await GET();
    const body = await res.json();
    expect(body.waitlistActive).toBe(false);
  });

  it('returns waitlistActive: true when count equals cap', async () => {
    vi.mocked(db.getFreeUserCount).mockResolvedValue(FREE_CAP);
    const res = await GET();
    const body = await res.json();
    expect(body.waitlistActive).toBe(true);
  });
});
