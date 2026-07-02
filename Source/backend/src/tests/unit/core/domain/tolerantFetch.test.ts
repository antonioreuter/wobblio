import { describe, it, expect, vi } from 'vitest';
import { fetchBytesTolerantly } from '@core/domain/tolerantFetch';

describe('fetchBytesTolerantly', () => {
  it('returns bytes for every ref that resolves', async () => {
    const getBytes = vi.fn(async (key: string) => new TextEncoder().encode(key));
    const result = await fetchBytesTolerantly(['a', 'b'], (k) => k, getBytes);
    expect(result.map((r) => r.ref)).toEqual(['a', 'b']);
  });

  it('skips a ref whose fetch rejects, preserving order of the survivors', async () => {
    const getBytes = vi.fn(async (key: string) => {
      if (key === 'bad') throw new Error('NoSuchKey');
      return new TextEncoder().encode(key);
    });
    const result = await fetchBytesTolerantly(['a', 'bad', 'c'], (k) => k, getBytes);
    expect(result.map((r) => r.ref)).toEqual(['a', 'c']);
  });

  it('processes refs in batches no larger than the given concurrency', async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    const getBytes = vi.fn(async (key: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return new TextEncoder().encode(key);
    });
    const refs = Array.from({ length: 10 }, (_, i) => `key-${i}`);
    await fetchBytesTolerantly(refs, (k) => k, getBytes, 3);
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('defaults to unbounded concurrency (all refs fetched in one batch)', async () => {
    const getBytes = vi.fn(async (key: string) => new TextEncoder().encode(key));
    const refs = ['a', 'b', 'c'];
    await fetchBytesTolerantly(refs, (k) => k, getBytes);
    expect(getBytes).toHaveBeenCalledTimes(3);
  });
});
