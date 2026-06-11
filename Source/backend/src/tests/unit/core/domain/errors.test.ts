import { describe, it, expect } from 'vitest';
import { EncryptionError, AiSpendCapExceededError, BedrockCallError } from '@core/domain/errors';

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

describe('AiSpendCapExceededError', () => {
  it('sets name, tenantId, currentSpend, cap, and message', () => {
    const err = new AiSpendCapExceededError('t-1', 0.10, 0.10);
    expect(err.name).toBe('AiSpendCapExceededError');
    expect(err.tenantId).toBe('t-1');
    expect(err.currentSpend).toBe(0.10);
    expect(err.cap).toBe(0.10);
    expect(err.message).toContain('t-1');
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
