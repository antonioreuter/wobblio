import { describe, it, expect } from 'vitest';
import { buildIngestionPush } from '@core/domain/pushNotification';

describe('buildIngestionPush', () => {
  it('builds a "ready" push for PARSED with a deep-link to the invoice', () => {
    const push = buildIngestionPush('PARSED', 'inv-1');
    expect(push).not.toBeNull();
    expect(push!.title).toBe('Your receipt is ready');
    expect(push!.data).toEqual({ type: 'INVOICE_PARSED', path: '/invoices/inv-1', invoiceId: 'inv-1' });
  });

  it('builds the same "ready" copy for NEEDS_REVIEW but a distinct type for client routing', () => {
    const push = buildIngestionPush('NEEDS_REVIEW', 'inv-2');
    expect(push!.title).toBe('Your receipt is ready');
    expect(push!.data.type).toBe('INVOICE_NEEDS_REVIEW');
    expect(push!.data.path).toBe('/invoices/inv-2');
  });

  it('builds a failure push for FAILED_PROCESSING', () => {
    const push = buildIngestionPush('FAILED_PROCESSING', 'inv-3');
    expect(push!.title).toBe("We couldn't process your receipt");
    expect(push!.data).toEqual({ type: 'INVOICE_FAILED', path: '/invoices/inv-3', invoiceId: 'inv-3' });
  });

  it('is silent (null) for non-actionable statuses', () => {
    expect(buildIngestionPush('PROCESSING', 'inv-4')).toBeNull();
    expect(buildIngestionPush('SUSPECTED_DUPLICATE', 'inv-5')).toBeNull();
    expect(buildIngestionPush('DISCARDED', 'inv-6')).toBeNull();
  });
});
