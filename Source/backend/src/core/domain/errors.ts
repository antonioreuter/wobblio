export class EncryptionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class AiSpendCapExceededError extends Error {
  constructor(
    readonly tenantId: string,
    readonly currentSpend: number,
    readonly cap: number,
  ) {
    super(`Daily AI spend cap exceeded for tenant ${tenantId}: ${currentSpend} >= ${cap}`);
    this.name = 'AiSpendCapExceededError';
  }
}

export class BedrockCallError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BedrockCallError';
  }
}

export class UserNotFoundError extends Error {
  constructor(readonly cognitoSub: string) {
    super(`User not found for cognito_sub: ${cognitoSub}`);
    this.name = 'UserNotFoundError';
  }
}

export class UserDeletedError extends Error {
  constructor(readonly cognitoSub: string) {
    super(`Account deleted for cognito_sub: ${cognitoSub}`);
    this.name = 'UserDeletedError';
  }
}

export class InvalidProfileError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid onboarding profile: ${reason}`);
    this.name = 'InvalidProfileError';
  }
}

export class WaitlistLockedError extends Error {
  constructor(
    readonly position: number,
    readonly total: number,
  ) {
    super(`Account is on the waitlist (position ${position} of ${total})`);
    this.name = 'WaitlistLockedError';
  }
}

export class InvalidBillingPlanError extends Error {
  constructor(readonly plan: string) {
    super(`Invalid billing plan: ${plan}`);
    this.name = 'InvalidBillingPlanError';
  }
}

export class BillingCustomerError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BillingCustomerError';
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
