// Non-Functional 02 · 03 §4 — friendly, internals-safe failure reasons.
// Maps a stable reason code to a pre-defined user-facing message. The raw root cause
// (system_fault_reason) never leaves the server; only these messages do.

export type FailureReasonCode =
  | 'BLURRY'
  | 'NOT_A_RECEIPT'
  | 'UNSUPPORTED_FORMAT'
  | 'TOO_LARGE'
  | 'SYSTEM_FAULT'
  | 'UNPROCESSABLE';

// The vision model's `unreadable` verdict (a user-fault, charged, deletable) — a strict
// subset of the failure codes a user can act on by re-uploading a better photo.
export type UnreadableReason = Extract<FailureReasonCode, 'BLURRY' | 'NOT_A_RECEIPT'>;

const MESSAGES: Record<FailureReasonCode, string> = {
  BLURRY: "We couldn't read this receipt — the photo was too blurry. Retake it in good light and try again.",
  NOT_A_RECEIPT: "This doesn't look like a receipt. Upload a photo of a store receipt, invoice, or restaurant bill.",
  UNSUPPORTED_FORMAT: "We couldn't read this file's format. Upload a JPEG, PNG, WebP, or PDF — convert HEIC photos to JPEG first.",
  TOO_LARGE: 'That file is too large. Try a smaller photo or a lighter PDF.',
  SYSTEM_FAULT: "Something went wrong on our side processing this receipt. Our team has been notified and will reprocess it for you — no scan was deducted.",
  UNPROCESSABLE: "We couldn't process this receipt after review. It's been closed — you can delete it and try a clearer photo. No scan was deducted.",
};

export function friendlyFailureMessage(code: FailureReasonCode): string {
  return MESSAGES[code];
}
