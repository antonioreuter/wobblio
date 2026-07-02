import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { BillingService } from '@core/services/billing/BillingService';
import { InvalidBillingPlanError } from '@core/domain/errors';
import type { IBillingGateway } from '@core/ports/billing/IBillingGateway';
import type { IBillingWhitelist } from '@core/ports/billing/IBillingWhitelist';
import type { IPaymentTransactionRepository } from '@core/ports/billing/IPaymentTransactionRepository';
import type { IBillingArchive } from '@core/ports/billing/IBillingArchive';
import type { IAppUserRepository } from '@core/ports/identity/IAppUserRepository';
import type { WebhookEvent } from '@core/domain/billing';

const URLS = {
  successUrl: 'https://app.wobblio.nl/upgrade/success',
  cancelUrl: 'https://app.wobblio.nl/upgrade/cancel?reason=not_whitelisted',
};

describe('BillingService', () => {
  let gateway: MockedObject<IBillingGateway>;
  let whitelist: MockedObject<IBillingWhitelist>;
  let paymentRepo: MockedObject<IPaymentTransactionRepository>;
  let archive: MockedObject<IBillingArchive>;
  let userRepo: MockedObject<IAppUserRepository>;
  let sut: BillingService;

  const buildSyntheticEvent = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
    id: 'evt_mock_1',
    type: 'checkout.session.completed',
    occurredAt: new Date('2026-06-11T00:00:00Z'),
    userId: 'user-1',
    customerId: 'cus_mock_x',
    plan: 'ANNUAL',
    amount: 25,
    currency: 'EUR',
    rawPayload: { mock: true },
    ...overrides,
  });

  beforeEach(() => {
    gateway = {
      createOrGetCustomer: vi.fn(),
      createCheckoutSession: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };
    whitelist = { isEmailAllowed: vi.fn() };
    paymentRepo = { upsertByStripeEventId: vi.fn() };
    archive = { archiveEventPayload: vi.fn() };
    userRepo = {
      findByCognitoSub: vi.fn(),
      insertUser: vi.fn(),
      promoteToPremium: vi.fn(),
      getProfile: vi.fn(),
      completeOnboarding: vi.fn(),
      setPriceContributionOptout: vi.fn(),
    };
    sut = new BillingService(gateway, whitelist, paymentRepo, archive, userRepo, URLS);
  });

  describe('createCheckoutSession', () => {
    it('rejects an invalid plan with InvalidBillingPlanError', async () => {
      await expect(
        sut.createCheckoutSession({ id: 'user-1', email: 'a@b.com' }, 'WEEKLY'),
      ).rejects.toBeInstanceOf(InvalidBillingPlanError);
    });

    it('returns CANCELED with cancel URL when email is not whitelisted, with no side effects', async () => {
      whitelist.isEmailAllowed.mockResolvedValue(false);

      const result = await sut.createCheckoutSession(
        { id: 'user-1', email: 'denied@b.com' },
        'ANNUAL',
      );

      expect(result).toEqual({ checkoutUrl: URLS.cancelUrl, status: 'CANCELED' });
      expect(gateway.createOrGetCustomer).not.toHaveBeenCalled();
      expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
      expect(paymentRepo.upsertByStripeEventId).not.toHaveBeenCalled();
      expect(archive.archiveEventPayload).not.toHaveBeenCalled();
      expect(userRepo.promoteToPremium).not.toHaveBeenCalled();
    });

    it('processes the auto-complete event and promotes the user when whitelisted', async () => {
      whitelist.isEmailAllowed.mockResolvedValue(true);
      gateway.createOrGetCustomer.mockResolvedValue({ customerId: 'cus_mock_x' });
      gateway.createCheckoutSession.mockResolvedValue({
        sessionId: 'cs_mock_1',
        url: 'https://app.wobblio.nl/upgrade/success?session_id=cs_mock_1',
        autoCompleteEvent: buildSyntheticEvent(),
      });
      archive.archiveEventPayload.mockResolvedValue({ s3Key: '2026/06/evt_mock_1.json' });
      paymentRepo.upsertByStripeEventId.mockResolvedValue({ inserted: true });

      const result = await sut.createCheckoutSession(
        { id: 'user-1', email: 'allowed@b.com' },
        'ANNUAL',
      );

      expect(result.status).toBe('PENDING');
      expect(result.checkoutUrl).toContain('/upgrade/success');
      expect(archive.archiveEventPayload).toHaveBeenCalledWith('evt_mock_1', expect.any(String));
      expect(paymentRepo.upsertByStripeEventId).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeEventId: 'evt_mock_1',
          type: 'SUBSCRIPTION_UPDATE',
          plan: 'ANNUAL',
          rawPayloadS3Key: '2026/06/evt_mock_1.json',
        }),
      );
      expect(userRepo.promoteToPremium).toHaveBeenCalledWith('user-1', 'cus_mock_x');
    });

    it('does not promote a second time when the same event id is replayed (idempotent)', async () => {
      whitelist.isEmailAllowed.mockResolvedValue(true);
      gateway.createOrGetCustomer.mockResolvedValue({ customerId: 'cus_mock_x' });
      gateway.createCheckoutSession.mockResolvedValue({
        sessionId: 'cs_mock_1',
        url: 'https://app.wobblio.nl/upgrade/success',
        autoCompleteEvent: buildSyntheticEvent({ id: 'evt_replay' }),
      });
      archive.archiveEventPayload.mockResolvedValue({ s3Key: '2026/06/evt_replay.json' });
      paymentRepo.upsertByStripeEventId.mockResolvedValue({ inserted: false });

      await sut.createCheckoutSession({ id: 'user-1', email: 'allowed@b.com' }, 'ANNUAL');

      expect(userRepo.promoteToPremium).not.toHaveBeenCalled();
    });
  });

  describe('processWebhookEvent', () => {
    it('archives payload, upserts transaction, and promotes user for checkout.session.completed', async () => {
      archive.archiveEventPayload.mockResolvedValue({ s3Key: '2026/06/evt.json' });
      paymentRepo.upsertByStripeEventId.mockResolvedValue({ inserted: true });

      await sut.processWebhookEvent(buildSyntheticEvent({ id: 'evt_x', userId: 'user-9' }));

      expect(userRepo.promoteToPremium).toHaveBeenCalledWith('user-9', 'cus_mock_x');
    });

    it('skips role promotion when the transaction was a replay', async () => {
      archive.archiveEventPayload.mockResolvedValue({ s3Key: '2026/06/evt.json' });
      paymentRepo.upsertByStripeEventId.mockResolvedValue({ inserted: false });

      await sut.processWebhookEvent(buildSyntheticEvent());

      expect(userRepo.promoteToPremium).not.toHaveBeenCalled();
    });
  });
});
