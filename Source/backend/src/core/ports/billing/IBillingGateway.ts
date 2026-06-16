import type { BillingPlan, WebhookEvent } from '@core/domain/billing';

export interface CreateCheckoutSessionInput {
  userId: string;
  email: string;
  customerId: string;
  plan: BillingPlan;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  url: string;
  autoCompleteEvent?: WebhookEvent;
}

export interface IBillingGateway {
  createOrGetCustomer(userId: string, email: string): Promise<{ customerId: string }>;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;
  verifyWebhookSignature(payload: string, signature: string): WebhookEvent;
}
