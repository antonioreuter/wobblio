import type { BillingPlan } from '@core/domain/billing';

export type PaymentTransactionType =
  | 'CHARGE'
  | 'REFUND'
  | 'DISPUTE'
  | 'SUBSCRIPTION_UPDATE';

export interface PaymentTransactionRow {
  userId: string;
  stripeEventId: string;
  type: PaymentTransactionType;
  amount: number;
  currency: string;
  plan: BillingPlan | null;
  occurredAt: Date;
  rawPayloadS3Key: string | null;
}

export interface IPaymentTransactionRepository {
  upsertByStripeEventId(row: PaymentTransactionRow): Promise<{ inserted: boolean }>;
}
