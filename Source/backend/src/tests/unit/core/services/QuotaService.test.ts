import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { QuotaService } from '@core/services/QuotaService';
import type { IQuotaRepository } from '@core/ports/IQuotaRepository';
import { QuotaExceededError } from '@core/domain/errors';

describe('QuotaService.getWeekStart', () => {
  let sut: QuotaService;

  beforeEach(() => {
    const mockRepo: MockedObject<IQuotaRepository> = { getUsed: vi.fn(), increment: vi.fn() };
    sut = new QuotaService(mockRepo);
  });

  it('returns the same day when input is a Monday', () => {
    const monday = new Date('2026-06-08T10:00:00Z'); // Monday
    expect(sut.getWeekStart(monday)).toBe('2026-06-08');
  });

  it('returns the previous Monday for a mid-week date (Wednesday)', () => {
    const wednesday = new Date('2026-06-10T14:30:00Z'); // Wednesday
    expect(sut.getWeekStart(wednesday)).toBe('2026-06-08');
  });

  it('returns the previous Monday for a Sunday', () => {
    const sunday = new Date('2026-06-14T23:59:59Z'); // Sunday
    expect(sut.getWeekStart(sunday)).toBe('2026-06-08');
  });

  it('returns correct Monday when week crosses month boundary', () => {
    const thursday = new Date('2026-07-02T08:00:00Z'); // Thursday
    expect(sut.getWeekStart(thursday)).toBe('2026-06-29');
  });
});

describe('QuotaService.getUsed', () => {
  let mockRepo: MockedObject<IQuotaRepository>;
  let sut: QuotaService;

  beforeEach(() => {
    mockRepo = { getUsed: vi.fn(), increment: vi.fn() };
    sut = new QuotaService(mockRepo);
  });

  it('delegates to repository with correct weekStart for given date', async () => {
    const wednesday = new Date('2026-06-10T10:00:00Z');
    mockRepo.getUsed.mockResolvedValue(2);

    const result = await sut.getUsed('tenant-abc', 'UPLOADS', wednesday);

    expect(mockRepo.getUsed).toHaveBeenCalledWith('tenant-abc', 'UPLOADS', '2026-06-08');
    expect(result).toBe(2);
  });
});

describe('QuotaService.reserveUpload', () => {
  let mockRepo: MockedObject<IQuotaRepository>;
  let sut: QuotaService;
  const wednesday = new Date('2026-06-10T10:00:00Z');

  beforeEach(() => {
    mockRepo = { getUsed: vi.fn(), increment: vi.fn() };
    sut = new QuotaService(mockRepo);
  });

  it('increments the counter when usage is below the cap', async () => {
    mockRepo.getUsed.mockResolvedValue(2);

    await sut.reserveUpload('tenant-abc', 'UPLOADS', 3, wednesday);

    expect(mockRepo.increment).toHaveBeenCalledWith('tenant-abc', 'UPLOADS', '2026-06-08');
  });

  it('throws QuotaExceededError and does not increment when usage equals the cap', async () => {
    mockRepo.getUsed.mockResolvedValue(3);

    await expect(sut.reserveUpload('tenant-abc', 'UPLOADS', 3, wednesday))
      .rejects.toBeInstanceOf(QuotaExceededError);
    expect(mockRepo.increment).not.toHaveBeenCalled();
  });
});
