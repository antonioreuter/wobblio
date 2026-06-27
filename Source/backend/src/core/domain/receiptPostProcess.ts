import type { ParsedReceipt, ParsedLine } from './ingestion';

// Deterministic safety net after vision parse. The prompt's <exclusion_list> is the
// primary defense; this catches summary/loyalty/metadata rows that slip through so they
// never reach merchant/product normalization or the price observation store (§6).
// Dropping non-item rows never edits amounts. The one amount-editing step is the
// quantity-continuation collapse below, which folds an "N x price" breakdown into the
// product line it describes — a structural de-duplication, not an arithmetic invention.

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

// A standalone quantity-continuation line: raw_text is ONLY an "N x unit_price"
// breakdown (e.g. "2 X 2,51", "3 x 0.99", "2 ST x 1,39"). Jumbo/AH print these directly
// below the product they belong to. The prompt tells the model to fold them into that
// product, but on long receipts it sometimes emits them as their own item — double-
// counting the amount. Matches a whole-line breakdown only; never a product name that
// merely contains an "x" (e.g. "WIT PUNTJE X 6", "COCA COLA ZERO 12X33").
const CONTINUATION_RE = /^\s*\d+\s*(?:st|stuks)?\s*[x×]\s*\d+[.,]\d{1,2}\s*$/i;
const AMOUNT_EPSILON = 0.005;

function isContinuationLine(line: ParsedLine): boolean {
  return CONTINUATION_RE.test(line.rawText);
}

// Fold a continuation line into the product above it. Returns null (leave both lines) when
// the merge would be a guess: the product is a discount, or it already carries a different
// non-zero total than the breakdown. Two safe cases: the product had no price (lift the
// breakdown's total), or its total duplicates the breakdown (drop the duplicate, keep one).
function foldContinuation(product: ParsedLine, continuation: ParsedLine): ParsedLine | null {
  if (product.lineTotal < 0 || isContinuationLine(product)) return null;
  const productHasNoPrice = Math.abs(product.lineTotal) < AMOUNT_EPSILON;
  const totalsDuplicate = Math.abs(product.lineTotal - continuation.lineTotal) < AMOUNT_EPSILON;
  if (!productHasNoPrice && !totalsDuplicate) return null;
  return {
    ...product,
    quantity: continuation.quantity,
    unitPrice: continuation.unitPrice ?? product.unitPrice,
    lineTotal: productHasNoPrice ? continuation.lineTotal : product.lineTotal,
  };
}

// Collapses each standalone "N x price" breakdown into the product line printed above it.
// Returns the receipt unchanged when none fold, keeping the clean path allocation-free.
export function collapseContinuationLines(receipt: ParsedReceipt): ParsedReceipt {
  const lines: ParsedLine[] = [];
  let folded = false;
  for (const line of receipt.lines) {
    const product = lines[lines.length - 1];
    const merged = product && isContinuationLine(line) ? foldContinuation(product, line) : null;
    if (merged) {
      lines[lines.length - 1] = merged;
      folded = true;
      continue;
    }
    lines.push(line);
  }
  return folded ? { ...receipt, lines } : receipt;
}
