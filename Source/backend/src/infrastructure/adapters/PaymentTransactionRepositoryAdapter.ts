import type { Pool, PoolClient } from 'pg';
import type {
  IPaymentTransactionRepository,
  PaymentTransactionRow,
} from '@core/ports/IPaymentTransactionRepository';

export class PaymentTransactionRepositoryAdapter implements IPaymentTransactionRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async upsertByStripeEventId(row: PaymentTransactionRow): Promise<{ inserted: boolean }> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO payment_transaction
         (user_id, stripe_event_id, type, amount, currency, plan, occurred_at, raw_payload_s3_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING id`,
      [
        row.userId,
        row.stripeEventId,
        row.type,
        row.amount,
        row.currency,
        row.plan,
        row.occurredAt.toISOString(),
        row.rawPayloadS3Key,
      ],
    );
    return { inserted: (result.rowCount ?? 0) > 0 };
  }
}
