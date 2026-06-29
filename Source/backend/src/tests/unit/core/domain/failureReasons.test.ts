import { describe, it, expect } from 'vitest';
import { friendlyFailureMessage, type FailureReasonCode } from '@core/domain/failureReasons';

describe('friendlyFailureMessage', () => {
  const codes: FailureReasonCode[] = ['BLURRY', 'NOT_A_RECEIPT', 'UNSUPPORTED_FORMAT', 'TOO_LARGE', 'SYSTEM_FAULT'];

  it('returns a non-empty, internals-safe message for every reason code', () => {
    for (const code of codes) {
      const message = friendlyFailureMessage(code);
      expect(message.length).toBeGreaterThan(0);
      // The friendly copy must never leak internal jargon / raw causes.
      expect(message.toLowerCase()).not.toMatch(/exception|stack|sqlstate|null|undefined/);
    }
  });

  it('reassures the user that a system fault deducted no scan', () => {
    expect(friendlyFailureMessage('SYSTEM_FAULT')).toContain('no scan was deducted');
  });
});
