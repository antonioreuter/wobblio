import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react';
import { useWaitlistStatus } from './use-waitlist-status';

describe('useWaitlistStatus', () => {
  it('transitions from initial-unknown to fetch-resolved state', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ waitlistActive: false }),
      } as Response)
    );

    const { result } = renderHook(() => useWaitlistStatus());

    expect(result.current.waitlistActive).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {});

    expect(result.current.waitlistActive).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});
