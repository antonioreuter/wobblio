import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminKpiService } from '@core/services/admin/AdminKpiService';
import { AdminAiSpendService } from '@core/services/admin/AdminAiSpendService';
import type { IKpiDailyReader } from '@core/ports/observability/IKpiDailyReader';
import type { IBedrockCostSource } from '@core/ports/observability/IBedrockCostSource';
import { InvalidAdminInputError } from '@core/domain/errors';

describe('AdminKpiService', () => {
  let reader: MockedObject<IKpiDailyReader>;

  beforeEach(() => {
    reader = { query: vi.fn().mockResolvedValue([]) };
  });

  it('defaults to the business metric set + a 90-day window', async () => {
    await new AdminKpiService(reader).query(undefined, undefined, '2026-06-22');
    const [metrics, from, to] = reader.query.mock.calls[0];
    expect(metrics).toContain('registrations');
    expect(metrics).toContain('mrr_eur');
    expect(to).toBe('2026-06-22');
    expect(from).toBe('2026-03-25'); // 90 days inclusive
  });

  it('honours an explicit metric list', async () => {
    await new AdminKpiService(reader).query('dau, mau', '2026-06-01', '2026-06-22');
    expect(reader.query).toHaveBeenCalledWith(['dau', 'mau'], '2026-06-01', '2026-06-22');
  });

  it('rejects a malformed date', async () => {
    await expect(new AdminKpiService(reader).query(undefined, 'yesterday', undefined)).rejects.toBeInstanceOf(
      InvalidAdminInputError,
    );
  });

  it('falls back to defaults when the metric csv is all empty', async () => {
    await new AdminKpiService(reader).query(',', '2026-06-01', '2026-06-22');
    const [metrics] = reader.query.mock.calls[0];
    expect(metrics).toContain('registrations');
  });

  it('rejects a window where from is after to', async () => {
    await expect(
      new AdminKpiService(reader).query(undefined, '2026-06-30', '2026-06-01'),
    ).rejects.toBeInstanceOf(InvalidAdminInputError);
  });
});

describe('AdminAiSpendService', () => {
  it('queries only the ai token + cost metrics over a 30-day default', async () => {
    const reader: MockedObject<IKpiDailyReader> = { query: vi.fn().mockResolvedValue([]) };
    await new AdminAiSpendService(reader).query(undefined, '2026-06-30');
    const [metrics, from, to] = reader.query.mock.calls[0];
    expect(metrics).toEqual(['ai_tokens', 'ai_cost']);
    expect(from).toBe('2026-06-01'); // 30 days inclusive
    expect(to).toBe('2026-06-30');
  });

  describe('actual (Cost Explorer)', () => {
    let reader: MockedObject<IKpiDailyReader>;
    let cost: MockedObject<IBedrockCostSource>;

    beforeEach(() => {
      reader = { query: vi.fn().mockResolvedValue([]) };
      cost = { getByModel: vi.fn().mockResolvedValue([]) };
    });

    it('defaults to DAILY and calls CE with an exclusive end (to + 1 day)', async () => {
      const res = await new AdminAiSpendService(reader, cost).actual(undefined, '2026-06-01', '2026-06-30');
      expect(cost.getByModel).toHaveBeenCalledWith('DAILY', '2026-06-01', '2026-07-01');
      expect(res.granularity).toBe('DAILY');
      expect(res.to).toBe('2026-06-30');
    });

    it('honours MONTHLY granularity', async () => {
      await new AdminAiSpendService(reader, cost).actual('MONTHLY', '2026-06-01', '2026-06-30');
      expect(cost.getByModel).toHaveBeenCalledWith('MONTHLY', '2026-06-01', '2026-07-01');
    });

    it('rejects an invalid granularity', async () => {
      await expect(
        new AdminAiSpendService(reader, cost).actual('HOURLY', undefined, undefined),
      ).rejects.toBeInstanceOf(InvalidAdminInputError);
    });

    it('throws when no cost source is configured', async () => {
      await expect(new AdminAiSpendService(reader).actual('DAILY', undefined, undefined)).rejects.toBeInstanceOf(
        InvalidAdminInputError,
      );
    });
  });
});
