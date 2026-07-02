import { MAX_HOUSEHOLD_MEMBERS } from './household';

export class EncryptionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'EncryptionError';
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

export class BillSplitNotFoundError extends Error {
  constructor(readonly splitId: string) {
    super(`Bill split not found: ${splitId}`);
    this.name = 'BillSplitNotFoundError';
  }
}

export class InvalidSplitError extends Error {
  constructor(reason: string) {
    super(`Invalid bill split: ${reason}`);
    this.name = 'InvalidSplitError';
  }
}

export class InvoiceNotDeletableError extends Error {
  constructor(readonly invoiceId: string, readonly status: string) {
    super(`Invoice ${invoiceId} cannot be deleted in status ${status}`);
    this.name = 'InvoiceNotDeletableError';
  }
}

// Only a parsed/needs-review invoice can be user-corrected (16e). A PROCESSING,
// duplicate, failed, or discarded invoice rejects the correction. Surfaces as 409.
export class InvoiceNotCorrectableError extends Error {
  constructor(readonly invoiceId: string, readonly status: string) {
    super(`Invoice ${invoiceId} cannot be corrected in status ${status}`);
    this.name = 'InvoiceNotCorrectableError';
  }
}

// A review-screen correction payload that fails validation (e.g. empty lines, a
// negative amount). Surfaces as 400.
export class InvalidCorrectionError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid invoice correction: ${reason}`);
    this.name = 'InvalidCorrectionError';
  }
}

// A system-fault-quarantined invoice (system_fault_reason set, §03.5). It is held for
// operator reprocess-on-behalf, so the user cannot delete it (which would also let them
// farm a free re-scan). Surfaces as 409.
export class InvoiceBlockedError extends Error {
  constructor(readonly invoiceId: string) {
    super(`Invoice ${invoiceId} is blocked pending reprocessing and cannot be deleted`);
    this.name = 'InvoiceBlockedError';
  }
}

export class InvalidFeedbackError extends Error {
  constructor(readonly verdict: string) {
    super(`Invalid feedback verdict: ${verdict}`);
    this.name = 'InvalidFeedbackError';
  }
}

export class LocationAlreadySetError extends Error {
  constructor(readonly invoiceId: string) {
    super(`Invoice location already set for ${invoiceId}; it can only be set once`);
    this.name = 'LocationAlreadySetError';
  }
}

export class LocationNotConfirmableError extends Error {
  constructor(readonly invoiceId: string, readonly status: string) {
    super(`Invoice ${invoiceId} cannot have its location confirmed in status ${status}`);
    this.name = 'LocationNotConfirmableError';
  }
}

export class InvalidLocationError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid invoice location: ${reason}`);
    this.name = 'InvalidLocationError';
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

export class UnsupportedUploadTypeError extends Error {
  constructor(readonly contentType: string) {
    super(`Unsupported upload type: ${contentType}`);
    this.name = 'UnsupportedUploadTypeError';
  }
}

export class OversizeUploadError extends Error {
  constructor(readonly invoiceId: string, readonly size: number, readonly limit: number) {
    super(`Upload for invoice ${invoiceId} is ${size} bytes, over the ${limit}-byte limit`);
    this.name = 'OversizeUploadError';
  }
}

export class TooManyPagesError extends Error {
  constructor(readonly invoiceId: string, readonly pages: number, readonly limit: number) {
    super(`PDF for invoice ${invoiceId} has ${pages} pages, over the ${limit}-page limit`);
    this.name = 'TooManyPagesError';
  }
}

export class PremiumRequiredError extends Error {
  constructor(readonly feature: string) {
    super(`Premium subscription required for ${feature}`);
    this.name = 'PremiumRequiredError';
  }
}

export class InvalidTrendQueryError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid price-trend query: ${reason}`);
    this.name = 'InvalidTrendQueryError';
  }
}

export class InvalidHouseholdError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid household: ${reason}`);
    this.name = 'InvalidHouseholdError';
  }
}

export class AlreadyOwnsHouseholdError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} already owns a household`);
    this.name = 'AlreadyOwnsHouseholdError';
  }
}

export class HouseholdNotFoundError extends Error {
  constructor(readonly householdId: string) {
    super(`Household not found: ${householdId}`);
    this.name = 'HouseholdNotFoundError';
  }
}

export class NotHouseholdOwnerError extends Error {
  // householdId is omitted when the caller belongs to no household at all (e.g. a
  // solo user attempting a household-scoped action that requires ownership).
  constructor(readonly householdId?: string) {
    super(householdId ? `Caller is not the owner of household ${householdId}` : 'Caller is not a household owner');
    this.name = 'NotHouseholdOwnerError';
  }
}

export class OwnerCannotLeaveError extends Error {
  constructor(readonly householdId: string) {
    super(`Owner cannot leave household ${householdId}; disband it instead`);
    this.name = 'OwnerCannotLeaveError';
  }
}

export class HouseholdFullError extends Error {
  constructor(readonly householdId: string) {
    super(`Household ${householdId} already has the maximum of ${MAX_HOUSEHOLD_MEMBERS} members`);
    this.name = 'HouseholdFullError';
  }
}

export class InvalidInviteError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid household invite: ${reason}`);
    this.name = 'InvalidInviteError';
  }
}

export class InvalidShareError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid invoice share link: ${reason}`);
    this.name = 'InvalidShareError';
  }
}

export class InvalidListShareError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid shopping list share link: ${reason}`);
    this.name = 'InvalidListShareError';
  }
}

export class InvalidBudgetError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid budget: ${reason}`);
    this.name = 'InvalidBudgetError';
  }
}

export class BudgetLimitError extends Error {
  constructor(readonly limit: number) {
    super(`Budget limit reached (max ${limit})`);
    this.name = 'BudgetLimitError';
  }
}

export class BudgetNotFoundError extends Error {
  constructor(readonly budgetId: string) {
    super(`Budget not found: ${budgetId}`);
    this.name = 'BudgetNotFoundError';
  }
}

export class InvalidListError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid shopping list: ${reason}`);
    this.name = 'InvalidListError';
  }
}

export class ListLimitError extends Error {
  constructor(readonly limit: number) {
    super(`Active shopping-list limit reached (max ${limit})`);
    this.name = 'ListLimitError';
  }
}

export class ListNotFoundError extends Error {
  constructor(readonly listId: string) {
    super(`Shopping list not found: ${listId}`);
    this.name = 'ListNotFoundError';
  }
}

export class ListItemNotFoundError extends Error {
  constructor(readonly itemId: string) {
    super(`Shopping list item not found: ${itemId}`);
    this.name = 'ListItemNotFoundError';
  }
}

// Admin console — invalid operator input (e.g. a release count or SSM value that
// fails validation). Carries a human-readable reason surfaced as a 400/422.
export class InvalidAdminInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAdminInputError';
  }
}

// Admin console — an unknown/non-allowlisted target (SSM param key or model role).
export class UnknownAdminTargetError extends Error {
  constructor(readonly target: string) {
    super(`Unknown admin target: ${target}`);
    this.name = 'UnknownAdminTargetError';
  }
}

// Admin console — a product merge refused because the source and target are not the
// same item (category/unit mismatch or too-low embedding similarity). Carries the
// failing guard so the operator sees why.
export class MergeNotAllowedError extends Error {
  constructor(readonly reason: string) {
    super(`Merge not allowed: ${reason}`);
    this.name = 'MergeNotAllowedError';
  }
}

// §14 GDPR export — a tenant already has a pending/processing/completed export request within
// the 24h window (FAILED requests don't count, so a crashed export doesn't lock out retry).
export class ExportRateLimitedError extends Error {
  constructor() {
    super('An export request was already made in the last 24 hours');
    this.name = 'ExportRateLimitedError';
  }
}

export class DataRequestNotFoundError extends Error {
  constructor(readonly requestId: string) {
    super(`Data request not found: ${requestId}`);
    this.name = 'DataRequestNotFoundError';
  }
}
