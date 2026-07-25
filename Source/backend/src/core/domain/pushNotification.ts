import type { InvoiceStatus } from './ingestion';
import type { PushData } from '../ports/notifications/IPushNotifier';

export interface IngestionPush {
  title: string;
  body: string;
  data: PushData;
}

// In-app deep-link target for a specific invoice (the mobile detail/review screen, 16g).
function invoicePath(invoiceId: string): string {
  return `/invoices/${invoiceId}`;
}

// The device push for a freshly-processed receipt. Only terminal states the user can act
// on get a push; PROCESSING / duplicate / discarded are silent. PARSED and NEEDS_REVIEW
// share the same user-facing "ready" copy (NEEDS_REVIEW presents as Ready per the 16d
// dashboard contract) but carry distinct `type`s so the client can route precisely.
export function buildIngestionPush(status: InvoiceStatus, invoiceId: string): IngestionPush | null {
  const path = invoicePath(invoiceId);
  if (status === 'PARSED' || status === 'NEEDS_REVIEW') {
    return {
      title: 'Your receipt is ready',
      body: 'We finished processing your receipt — tap to view it.',
      data: {
        type: status === 'PARSED' ? 'INVOICE_PARSED' : 'INVOICE_NEEDS_REVIEW',
        path,
        invoiceId,
      },
    };
  }
  if (status === 'FAILED_PROCESSING') {
    return {
      title: "We couldn't process your receipt",
      body: 'Something went wrong processing your receipt — tap for details.',
      data: { type: 'INVOICE_FAILED', path, invoiceId },
    };
  }
  // Fix 11 Layer C: a legible-enough photo we still couldn't parse — ask for a retake (no charge).
  if (status === 'RETAKE_SUGGESTED') {
    return {
      title: 'Please retake this receipt',
      body: "We couldn't get a reliable read — tap to see how to retake it. No scan was deducted.",
      data: { type: 'INVOICE_FAILED', path, invoiceId },
    };
  }
  return null;
}
