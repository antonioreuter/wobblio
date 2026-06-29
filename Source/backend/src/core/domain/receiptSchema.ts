import type { ParsedReceipt, ParsedLine, ParsedLocation, UnreadableVerdict } from './ingestion';
import type { UnreadableReason } from './failureReasons';
import { extractJsonObject } from './jsonExtract';

// A valid model output is either a receipt or the `unreadable` verdict (§03.2). Both are
// "ok" (no retry): the verdict is a legitimate answer for a blurry/non-receipt image.
export type ReceiptParseResult =
  | { ok: true; value: ParsedReceipt | UnreadableVerdict }
  | { ok: false; issues: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNREADABLE_REASONS: readonly UnreadableReason[] = ['BLURRY', 'NOT_A_RECEIPT'];

function parseUnreadableVerdict(raw: Record<string, unknown>): ReceiptParseResult {
  const reason = raw.reason;
  if (typeof reason !== 'string' || !UNREADABLE_REASONS.includes(reason as UnreadableReason)) {
    return { ok: false, issues: 'unreadable.reason must be one of BLURRY, NOT_A_RECEIPT' };
  }
  return { ok: true, value: { unreadable: true, reason: reason as UnreadableReason } };
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateLine(line: unknown, index: number, issues: string[]): ParsedLine | null {
  if (typeof line !== 'object' || line === null) {
    issues.push(`lines[${index}] must be an object`);
    return null;
  }
  const l = line as Record<string, unknown>;
  if (typeof l.raw_text !== 'string' || l.raw_text.length === 0) issues.push(`lines[${index}].raw_text must be a non-empty string`);
  if (!isNum(l.quantity)) issues.push(`lines[${index}].quantity must be a number`);
  if (!isNum(l.line_total)) issues.push(`lines[${index}].line_total must be a number`);
  // Optional fields: the vision model emits explicit `null` (not absent) when a line
  // has no value, so treat null the same as undefined rather than failing validation.
  if (l.unit_price != null && !isNum(l.unit_price)) issues.push(`lines[${index}].unit_price must be a number`);
  if (l.unit_size_raw != null && typeof l.unit_size_raw !== 'string') issues.push(`lines[${index}].unit_size_raw must be a string`);
  if (issues.length > 0) return null;
  return {
    rawText: l.raw_text as string,
    quantity: l.quantity as number,
    lineTotal: l.line_total as number,
    unitPrice: (l.unit_price ?? undefined) as number | undefined,
    unitSizeRaw: (l.unit_size_raw ?? undefined) as string | undefined,
  };
}

// Optional printed store address. The model emits explicit `null` (not absent) for
// fields it can't read, so null is treated as undefined. A present country must be a
// 2-letter code; an invalid one fails validation rather than silently mis-resolving.
function validateLocation(raw: unknown, issues: string[]): ParsedLocation | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object') {
    issues.push('location must be an object');
    return undefined;
  }
  const l = raw as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

  const countryCode = str(l.country_code);
  if (countryCode !== undefined && countryCode.length !== 2) {
    issues.push('location.country_code must be a 2-letter code');
    return undefined;
  }
  const location: ParsedLocation = {
    countryCode: countryCode?.toUpperCase(),
    regionText: str(l.region_text),
    city: str(l.city),
    postalCode: str(l.postal_code),
  };
  // Drop an all-empty block so downstream sees `undefined`, not a hollow object.
  return Object.values(location).some(v => v !== undefined) ? location : undefined;
}

export function parseReceiptJson(content: string): ReceiptParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonObject(content));
  } catch {
    return { ok: false, issues: 'output is not valid JSON' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, issues: 'output must be a JSON object' };

  const r = raw as Record<string, unknown>;
  if (r.unreadable === true) return parseUnreadableVerdict(r);

  const issues: string[] = [];
  if (typeof r.merchant_raw !== 'string' || r.merchant_raw.length === 0) issues.push('merchant_raw must be a non-empty string');
  if (typeof r.transaction_date !== 'string' || !DATE_RE.test(r.transaction_date)) issues.push('transaction_date must be YYYY-MM-DD');
  if (typeof r.currency !== 'string' || r.currency.length !== 3) issues.push('currency must be a 3-letter code');
  if (!isNum(r.total)) issues.push('total must be a number');
  if (!isNum(r.parse_confidence) || (r.parse_confidence as number) < 0 || (r.parse_confidence as number) > 1) issues.push('parse_confidence must be a number in [0,1]');
  if (r.document_kind_hint !== undefined && typeof r.document_kind_hint !== 'string') issues.push('document_kind_hint must be a string');
  if (!Array.isArray(r.lines) || r.lines.length === 0) issues.push('lines must be a non-empty array');

  if (issues.length > 0) return { ok: false, issues: issues.join('; ') };

  const lines: ParsedLine[] = [];
  for (let i = 0; i < (r.lines as unknown[]).length; i++) {
    const parsed = validateLine((r.lines as unknown[])[i], i, issues);
    if (parsed) lines.push(parsed);
  }
  const location = validateLocation(r.location, issues);
  if (issues.length > 0) return { ok: false, issues: issues.join('; ') };

  return {
    ok: true,
    value: {
      merchantRaw: r.merchant_raw as string,
      transactionDate: r.transaction_date as string,
      currency: (r.currency as string).toUpperCase(),
      total: r.total as number,
      documentKindHint: r.document_kind_hint as string | undefined,
      location,
      lines,
      parseConfidence: r.parse_confidence as number,
    },
  };
}
