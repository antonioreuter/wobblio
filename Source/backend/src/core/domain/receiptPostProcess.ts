import type { ParsedReceipt, ParsedLine } from './ingestion';

// Deterministic safety net after vision parse. The prompt's <exclusion_list> is the
// primary defense; this catches summary/loyalty/metadata rows that slip through so they
// never reach merchant/product normalization or the price observation store (§6).
// Scope is intentionally narrow: drop non-item rows only. It never edits amounts —
// arithmetic reconciliation stays the model's job and feeds decideStatus.

// Boundary/substring matches on the verbatim raw_text (any language on the NL sample set).
const EXCLUSION_PATTERNS: RegExp[] = [
  // Totals / subtotals
  /\bsubtotaal\b/i,
  /\bsubtotal\b/i,
  /^\s*totaal\b/i,
  /^\s*total\b/i,
  /\bjouw\s+voordeel\b/i,
  /\bbonus\s+box\s+premium\b/i,
  // Promo-savings grand total (sum of inline discounts) — TOTAL prefix required so
  // per-item "KORTING ..." discount lines are NOT dropped.
  /^\s*total(e)?\s+actiekorting\b/i,
  /^\s*total(e)?\s+korting\b/i,
  /^\s*total\s+discount\b/i,
  // Tax footer summaries
  /^\s*btw\b/i,
  /^\s*vat\b/i,
  /^\s*mwst\b/i,
  /\bbtw\s*totaal\b/i,
  /\btax\s+total\b/i,
  // Loyalty / membership
  /\bbonus\s*kaart\b/i,
  /\bair\s*miles?\b/i,
  /\bpasnummer\b/i,
  /\bpasnr\b/i,
  /\bclubkaart\b/i,
  /\bpayback\b/i,
  /\bjumbo\s+extra\b/i,
  /\bmijn\s+ah\s+miles\b/i,
  // Payment / card metadata
  /\bbetaald\s+met\b/i,
  /\bpinnen\b/i,
  /\bmaestro\b/i,
  /\bcontactloze\b/i,
  /\bkaartnr\b/i,
  /\bauth\.?\s*code\b/i,
  /\btransactie\b/i,
  /\btransaction\b/i,
  /\bterminal\b/i,
  /\bcard\s+sequence\b/i,
  // Operational metadata
  /\bmedewerker\b/i,
  /\bkassa\b/i,
  /\bkassier\b/i,
  /\bcashier\b/i,
  /\bopeningstijden\b/i,
  /\baantal\s+artikelen\b/i,
  /\baantal\s+juichzegels\b/i,
  // Footer text
  /privacy\s+statement/i,
  /vragen\s+over\s+je\s+kassabon/i,
  /customer'?s?\s+receipt/i,
];

function isNonItemRow(line: ParsedLine): boolean {
  return EXCLUSION_PATTERNS.some(re => re.test(line.rawText));
}

// Returns a receipt with non-item rows removed. Returns the receipt unchanged when
// nothing matches, so the common (clean) path allocates nothing extra.
export function dropNonItemLines(receipt: ParsedReceipt): ParsedReceipt {
  const lines = receipt.lines.filter(line => !isNonItemRow(line));
  if (lines.length === receipt.lines.length) return receipt;
  return { ...receipt, lines };
}
