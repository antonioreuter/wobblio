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

export class DuplicateInvoiceError extends Error {
  constructor(readonly imageSha256: string) {
    super(`Receipt already scanned (sha256 ${imageSha256})`);
    this.name = 'DuplicateInvoiceError';
  }
}

export class QuotaExceededError extends Error {
  constructor(
    readonly counter: string,
    readonly used: number,
    readonly cap: number,
  ) {
    super(`Upload quota exceeded for ${counter}: ${used} >= ${cap}`);
    this.name = 'QuotaExceededError';
  }
}

export class InvoiceNotFoundError extends Error {
  constructor(readonly invoiceId: string) {
    super(`Invoice not found: ${invoiceId}`);
    this.name = 'InvoiceNotFoundError';
  }
}

export class SchemaValidationError extends Error {
  constructor(readonly issues: string) {
    super(`Output failed schema validation: ${issues}`);
    this.name = 'SchemaValidationError';
  }
}

export class StaleUploadError extends Error {
  constructor(readonly invoiceId: string) {
    super(`Upload object missing or expired for invoice ${invoiceId}`);
    this.name = 'StaleUploadError';
  }
}
