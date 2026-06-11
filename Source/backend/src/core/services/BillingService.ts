import type { IBillingGateway } from '../ports/IBillingGateway';
import type { IBillingWhitelist } from '../ports/IBillingWhitelist';
import type { IPaymentTransactionRepository } from '../ports/IPaymentTransactionRepository';
import type { IBillingArchive } from '../ports/IBillingArchive';
import type { IAppUserRepository } from '../ports/IAppUserRepository';
import type { BillingPlan, CheckoutResult, WebhookEvent } from '../domain/billing';
import { InvalidBillingPlanError } from '../domain/errors';

const VALID_PLANS: readonly BillingPlan[] = ['MONTHLY', 'ANNUAL'];

export interface BillingServiceUrls {
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutUser {
  id: string;
  email: string;
}

export class BillingService {
  constructor(
    private readonly gateway: IBillingGateway,
    private readonly whitelist: IBillingWhitelist,
    private readonly paymentRepo: IPaymentTransactionRepository,
    private readonly archive: IBillingArchive,
    private readonly userRepo: IAppUserRepository,
    private readonly urls: BillingServiceUrls,
  ) {}

  async createCheckoutSession(user: CheckoutUser, plan: string): Promise<CheckoutResult> {
    if (!VALID_PLANS.includes(plan as BillingPlan)) {
      throw new InvalidBillingPlanError(plan);
    }
    const billingPlan = plan as BillingPlan;

    const allowed = await this.whitelist.isEmailAllowed(user.email);
    if (!allowed) {
      return { checkoutUrl: this.urls.cancelUrl, status: 'CANCELED' };
    }

    const { customerId } = await this.gateway.createOrGetCustomer(user.id, user.email);
    const session = await this.gateway.createCheckoutSession({
      userId: user.id,
      email: user.email,
      customerId,
      plan: billingPlan,
      successUrl: this.urls.successUrl,
      cancelUrl: this.urls.cancelUrl,
    });

    if (session.autoCompleteEvent) {
      await this.processWebhookEvent(session.autoCompleteEvent);
    }

    return { checkoutUrl: session.url, status: 'PENDING' };
  }

  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    const { s3Key } = await this.archive.archiveEventPayload(
      event.id,
      JSON.stringify(event.rawPayload),
    );

    const { inserted } = await this.paymentRepo.upsertByStripeEventId({
      userId: event.userId,
      stripeEventId: event.id,
      type: 'SUBSCRIPTION_UPDATE',
      amount: event.amount,
      currency: event.currency,
      plan: event.plan,
      occurredAt: event.occurredAt,
      rawPayloadS3Key: s3Key,
    });

    if (!inserted) return;

    if (event.type === 'checkout.session.completed') {
      await this.userRepo.promoteToPremium(event.userId, event.customerId);
    }
  }
}
