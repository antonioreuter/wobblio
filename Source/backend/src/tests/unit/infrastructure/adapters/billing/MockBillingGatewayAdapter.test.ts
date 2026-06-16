import { describe, it, expect, beforeEach } from 'vitest';
import { MockBillingGatewayAdapter } from '@infrastructure/adapters/billing/MockBillingGatewayAdapter';
import { WebhookVerificationError } from '@core/domain/errors';

describe('MockBillingGatewayAdapter', () => {
  let adapter: MockBillingGatewayAdapter;

  beforeEach(() => {
    adapter = new MockBillingGatewayAdapter();
  });

  describe('createOrGetCustomer', () => {
    it('returns a deterministic cus_mock_ id derived from the user id', async () => {
      const a = await adapter.createOrGetCustomer('user-1', 'a@b.com');
      const b = await adapter.createOrGetCustomer('user-1', 'a@b.com');

      expect(a.customerId).toBe(b.customerId);
      expect(a.customerId).toMatch(/^cus_mock_[a-f0-9]{16}$/);
    });

    it('returns different ids for different users', async () => {
      const a = await adapter.createOrGetCustomer('user-1', 'a@b.com');
      const b = await adapter.createOrGetCustomer('user-2', 'a@b.com');

      expect(a.customerId).not.toBe(b.customerId);
    });
  });

  describe('createCheckoutSession', () => {
    it('returns a cs_mock_ session id, a success URL with the session_id query param, and an auto-complete event', async () => {
      const result = await adapter.createCheckoutSession({
        userId: 'user-1',
        email: 'a@b.com',
        customerId: 'cus_mock_x',
        plan: 'ANNUAL',
        successUrl: 'https://app.wobblio.nl/upgrade/success',
        cancelUrl: 'https://app.wobblio.nl/upgrade/cancel',
      });

      expect(result.sessionId).toMatch(/^cs_mock_/);
      expect(result.url).toContain('/upgrade/success?session_id=');
      expect(result.autoCompleteEvent).toBeDefined();
      expect(result.autoCompleteEvent?.type).toBe('checkout.session.completed');
      expect(result.autoCompleteEvent?.userId).toBe('user-1');
      expect(result.autoCompleteEvent?.plan).toBe('ANNUAL');
      expect(result.autoCompleteEvent?.amount).toBe(25);
      expect(result.autoCompleteEvent?.currency).toBe('EUR');
    });

    it('uses the monthly price when plan is MONTHLY', async () => {
      const result = await adapter.createCheckoutSession({
        userId: 'user-1',
        email: 'a@b.com',
        customerId: 'cus_mock_x',
        plan: 'MONTHLY',
        successUrl: 'https://app.wobblio.nl/upgrade/success',
        cancelUrl: 'https://app.wobblio.nl/upgrade/cancel',
      });

      expect(result.autoCompleteEvent?.amount).toBe(2.5);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('throws WebhookVerificationError because the mock does not accept external webhooks', () => {
      expect(() => adapter.verifyWebhookSignature('{}', 'sig')).toThrow(WebhookVerificationError);
    });
  });
});
