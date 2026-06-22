import { describe, it, expect } from 'vitest';
import {
  EncryptionError,
  BedrockCallError,
  UserNotFoundError,
  UserDeletedError,
  WaitlistLockedError,
  InvalidBillingPlanError,
  BillingCustomerError,
  WebhookVerificationError,
} from '@core/domain/errors';

describe('EncryptionError', () => {
  it('sets name and message', () => {
    const err = new EncryptionError('kms failed');
    expect(err.name).toBe('EncryptionError');
    expect(err.message).toBe('kms failed');
  });

  it('preserves optional cause', () => {
    const cause = new Error('root');
    const err = new EncryptionError('wrapped', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('BedrockCallError', () => {
  it('sets name and message', () => {
    const err = new BedrockCallError('timeout');
    expect(err.name).toBe('BedrockCallError');
    expect(err.message).toBe('timeout');
  });

  it('preserves optional cause', () => {
    const cause = new Error('sdk error');
    const err = new BedrockCallError('wrapped', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('UserNotFoundError', () => {
  it('sets name, cognitoSub, and message', () => {
    const err = new UserNotFoundError('sub-abc');
    expect(err.name).toBe('UserNotFoundError');
    expect(err.cognitoSub).toBe('sub-abc');
    expect(err.message).toContain('sub-abc');
  });
});

describe('UserDeletedError', () => {
  it('sets name, cognitoSub, and message', () => {
    const err = new UserDeletedError('sub-xyz');
    expect(err.name).toBe('UserDeletedError');
    expect(err.cognitoSub).toBe('sub-xyz');
    expect(err.message).toContain('sub-xyz');
  });
});

describe('WaitlistLockedError', () => {
  it('sets name, position, total, and message', () => {
    const err = new WaitlistLockedError(5, 20);
    expect(err.name).toBe('WaitlistLockedError');
    expect(err.position).toBe(5);
    expect(err.total).toBe(20);
    expect(err.message).toContain('5');
    expect(err.message).toContain('20');
  });
});

describe('InvalidBillingPlanError', () => {
  it('sets name, plan, and message', () => {
    const err = new InvalidBillingPlanError('WEEKLY');
    expect(err.name).toBe('InvalidBillingPlanError');
    expect(err.plan).toBe('WEEKLY');
    expect(err.message).toContain('WEEKLY');
  });
});

describe('BillingCustomerError', () => {
  it('sets name and message', () => {
    const err = new BillingCustomerError('customer lookup failed');
    expect(err.name).toBe('BillingCustomerError');
    expect(err.message).toBe('customer lookup failed');
  });

  it('preserves optional cause', () => {
    const cause = new Error('stripe sdk error');
    const err = new BillingCustomerError('wrapped', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('WebhookVerificationError', () => {
  it('sets name and message', () => {
    const err = new WebhookVerificationError('signature mismatch');
    expect(err.name).toBe('WebhookVerificationError');
    expect(err.message).toBe('signature mismatch');
  });
});
