import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { buildWaitlistStatusResponse } from '@handlers/waitlist-status/index';
import type { IWaitlistStatusPort } from '@core/ports/waitlist/IWaitlistStatusPort';

describe('waitlist-status handler', () => {
  let port: MockedObject<IWaitlistStatusPort>;

  beforeEach(() => {
    port = { isWaitlistActive: vi.fn() };
  });

  it('returns 200 with waitlistActive: true when cap is reached', async () => {
    port.isWaitlistActive.mockResolvedValue(true);
    const result = await buildWaitlistStatusResponse(port);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ waitlistActive: true });
  });

  it('returns 200 with waitlistActive: false when cap is not reached', async () => {
    port.isWaitlistActive.mockResolvedValue(false);
    const result = await buildWaitlistStatusResponse(port);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ waitlistActive: false });
  });

  it('sets Cache-Control header for CDN caching', async () => {
    port.isWaitlistActive.mockResolvedValue(false);
    const result = await buildWaitlistStatusResponse(port);
    expect(result.headers?.['Cache-Control']).toBe('public, s-maxage=300, stale-while-revalidate=60');
  });
});
