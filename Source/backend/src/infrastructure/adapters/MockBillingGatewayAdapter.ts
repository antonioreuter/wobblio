import { randomUUID, createHash } from 'crypto';
import type {
  IBillingGateway,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
} from '@core/ports/IBillingGateway';
import type { WebhookEvent } from '@core/domain/billing';
import { WebhookVerificationError } from '@core/domain/errors';

const PRICE_BY_PLAN: Record<'MONTHLY' | 'ANNUAL', number> = {
  MONTHLY: 2.5,
  ANNUAL: 25,
};

export class MockBillingGatewayAdapter implements IBillingGateway {
  async createOrGetCustomer(userId: string, _email: string): Promise<{ customerId: string }> {
    const hash = createHash('sha256').update(userId).digest('hex').slice(0, 16);
    return { customerId: `cus_mock_${hash}` };
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    const sessionId = `cs_mock_${randomUUID()}`;
    const successWithSession = appendQueryParam(input.successUrl, 'session_id', sessionId);

    const event: WebhookEvent = {
      id: `evt_mock_${randomUUID()}`,
      type: 'checkout.session.completed',
      occurredAt: new Date(),
      userId: input.userId,
      customerId: input.customerId,
      plan: input.plan,
      amount: PRICE_BY_PLAN[input.plan],
      currency: 'EUR',
      rawPayload: {
        mock: true,
        session_id: sessionId,
        customer: input.customerId,
        client_reference_id: input.userId,
        metadata: { user_id: input.userId, plan: input.plan },
        amount_total: Math.round(PRICE_BY_PLAN[input.plan] * 100),
        currency: 'eur',
      },
    };

    return { sessionId, url: successWithSession, autoCompleteEvent: event };
  }

  verifyWebhookSignature(_payload: string, _signature: string): WebhookEvent {
    throw new WebhookVerificationError('Mock gateway does not accept external webhooks');
  }
}

function appendQueryParam(url: string, key: string, value: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
