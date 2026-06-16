import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pool } from 'pg';
import { PaymentTransactionRepositoryAdapter } from '@infrastructure/adapters/billing/PaymentTransactionRepositoryAdapter';

describe('PaymentTransactionRepositoryAdapter', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let adapter: PaymentTransactionRepositoryAdapter;

  beforeEach(() => {
    mockPool = { query: vi.fn() };
    adapter = new PaymentTransactionRepositoryAdapter(mockPool as unknown as Pool);
  });

  it('inserts a row with the expected ON CONFLICT DO NOTHING shape', async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'new-uuid' }] });

    const occurredAt = new Date('2026-06-11T10:00:00Z');
    const result = await adapter.upsertByStripeEventId({
      userId: 'user-1',
      stripeEventId: 'evt_1',
      type: 'SUBSCRIPTION_UPDATE',
      amount: 25,
      currency: 'EUR',
      plan: 'ANNUAL',
      occurredAt,
      rawPayloadS3Key: '2026/06/evt_1.json',
    });

    expect(result.inserted).toBe(true);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO payment_transaction');
    expect(sql).toContain('ON CONFLICT (stripe_event_id) DO NOTHING');
    expect(sql).toContain('RETURNING id');
    expect(params).toEqual([
      'user-1',
      'evt_1',
      'SUBSCRIPTION_UPDATE',
      25,
      'EUR',
      'ANNUAL',
      occurredAt.toISOString(),
      '2026/06/evt_1.json',
    ]);
  });

  it('returns inserted=false when ON CONFLICT skipped the row (replay)', async () => {
    mockPool.query.mockResolvedValue({ rowCount: 0, rows: [] });

    const result = await adapter.upsertByStripeEventId({
      userId: 'user-1',
      stripeEventId: 'evt_replay',
      type: 'SUBSCRIPTION_UPDATE',
      amount: 25,
      currency: 'EUR',
      plan: 'ANNUAL',
      occurredAt: new Date(),
      rawPayloadS3Key: null,
    });

    expect(result.inserted).toBe(false);
  });
});
