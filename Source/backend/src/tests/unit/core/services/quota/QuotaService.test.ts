import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { QuotaService } from '@core/services/quota/QuotaService';
import type { IQuotaRepository } from '@core/ports/quota/IQuotaRepository';

function buildRepo(): MockedObject<IQuotaRepository> {
  return { getUsed: vi.fn(), increment: vi.fn(), decrement: vi.fn() };
}

describe('QuotaService.getWeekStart', () => {
  const sut = new QuotaService(buildRepo());

  it('returns the same day when input is a Monday', () => {
    expect(sut.getWeekStart(new Date('2026-06-08T10:00:00Z'))).toBe('2026-06-08');
  });

  it('returns the previous Monday for a mid-week date (Wednesday)', () => {
    expect(sut.getWeekStart(new Date('2026-06-10T14:30:00Z'))).toBe('2026-06-08');
  });

  it('returns the previous Monday for a Sunday', () => {
    expect(sut.getWeekStart(new Date('2026-06-14T23:59:59Z'))).toBe('2026-06-08');
  });

  it('returns correct Monday when week crosses month boundary', () => {
    expect(sut.getWeekStart(new Date('2026-07-02T08:00:00Z'))).toBe('2026-06-29');
  });
});

describe('QuotaService.getUsed', () => {
  let mockRepo: MockedObject<IQuotaRepository>;
  let sut: QuotaService;

  beforeEach(() => {
    mockRepo = buildRepo();
    sut = new QuotaService(mockRepo);
  });

  it('delegates to repository with correct weekStart for given date', async () => {
    mockRepo.getUsed.mockResolvedValue(2000);
    const result = await sut.getUsed('tenant-abc', 'CREDITS', new Date('2026-06-10T10:00:00Z'));
    expect(mockRepo.getUsed).toHaveBeenCalledWith('tenant-abc', 'CREDITS', '2026-06-08');
    expect(result).toBe(2000);
  });
});

describe('QuotaService.checkAvailability', () => {
  let mockRepo: MockedObject<IQuotaRepository>;
  let sut: QuotaService;
  const wednesday = new Date('2026-06-10T10:00:00Z');

  beforeEach(() => {
    mockRepo = buildRepo();
    sut = new QuotaService(mockRepo);
  });

  it('is available and reads no counter for an unlimited (Infinity) cap', async () => {
    const ok = await sut.checkAvailability('t', 'CREDITS', Number.POSITIVE_INFINITY, wednesday);
    expect(ok).toBe(true);
    expect(mockRepo.getUsed).not.toHaveBeenCalled();
  });

  it('is available while usage is strictly below the cap', async () => {
    mockRepo.getUsed.mockResolvedValue(95_000);
    expect(await sut.checkAvailability('t', 'CREDITS', 100_000, wednesday)).toBe(true);
  });

  it('allows one last upload that will push usage over the cap (soft cap)', async () => {
    mockRepo.getUsed.mockResolvedValue(99_999); // a single token under the cap
    expect(await sut.checkAvailability('t', 'CREDITS', 100_000, wednesday)).toBe(true);
  });

  it('is unavailable once usage reaches the cap', async () => {
    mockRepo.getUsed.mockResolvedValue(100_000);
    expect(await sut.checkAvailability('t', 'CREDITS', 100_000, wednesday)).toBe(false);
  });

  it('counts the in-flight projection toward the cap (burst guard)', async () => {
    mockRepo.getUsed.mockResolvedValue(85_000);
    // 85k used + 2 in-flight × 10k = 105k ≥ 100k → blocked.
    expect(await sut.checkAvailability('t', 'CREDITS', 100_000, wednesday, 20_000)).toBe(false);
    // 85k + 1 × 10k = 95k < 100k → allowed.
    expect(await sut.checkAvailability('t', 'CREDITS', 100_000, wednesday, 10_000)).toBe(true);
  });

  it('never writes (read-only check)', async () => {
    mockRepo.getUsed.mockResolvedValue(0);
    await sut.checkAvailability('t', 'CREDITS', 100_000, wednesday);
    expect(mockRepo.increment).not.toHaveBeenCalled();
    expect(mockRepo.decrement).not.toHaveBeenCalled();
  });
});

describe('QuotaService.charge', () => {
  let mockRepo: MockedObject<IQuotaRepository>;
  let sut: QuotaService;

  beforeEach(() => {
    mockRepo = buildRepo();
    sut = new QuotaService(mockRepo);
  });

  it('increments the counter by the actual tokens consumed', async () => {
    await sut.charge('hh-1', 'HOUSEHOLD_CREDITS', '2026-06-08', 8_500);
    expect(mockRepo.increment).toHaveBeenCalledWith('hh-1', 'HOUSEHOLD_CREDITS', '2026-06-08', 8_500);
  });
});
