export type BillingPlan = 'MONTHLY' | 'ANNUAL';

export type WebhookEventType =
  | 'checkout.session.completed';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  occurredAt: Date;
  userId: string;
  customerId: string;
  plan: BillingPlan;
  amount: number;
  currency: string;
  rawPayload: Record<string, unknown>;
}

export type CheckoutStatus = 'PENDING' | 'CANCELED';

export interface CheckoutResult {
  checkoutUrl: string;
  status: CheckoutStatus;
}
