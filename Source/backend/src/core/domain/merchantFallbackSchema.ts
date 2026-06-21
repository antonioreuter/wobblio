import { extractJsonObject } from './jsonExtract';
import { isValidCategoryId, macroCategoryId } from './categoryTaxonomy';

// Validates the §6.2 merchant-fallback LLM output: pick an existing candidate by id
// or declare a new merchant with a cleaned brand name. For a new merchant the model
// may also propose a macro default-category prior so the classifier has an anchor.

export interface MerchantFallback {
  merchantId: string | null;
  brandName: string;
  isNew: boolean;
  defaultCategoryId: string | null;
}

export type MerchantFallbackResult =
  | { ok: true; value: MerchantFallback }
  | { ok: false; issues: string };

export function parseMerchantFallbackJson(content: string): MerchantFallbackResult {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonObject(content));
  } catch {
    return { ok: false, issues: 'output is not valid JSON' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, issues: 'output must be a JSON object' };

  const r = raw as Record<string, unknown>;
  const issues: string[] = [];
  if (typeof r.brand_name !== 'string' || r.brand_name.trim().length === 0) issues.push('brand_name must be a non-empty string');
  if (typeof r.is_new !== 'boolean') issues.push('is_new must be a boolean');
  if (r.merchant_id !== null && r.merchant_id !== undefined && typeof r.merchant_id !== 'string') issues.push('merchant_id must be a string or null');
  if (issues.length > 0) return { ok: false, issues: issues.join('; ') };

  return {
    ok: true,
    value: {
      merchantId: (r.merchant_id as string | null | undefined) ?? null,
      brandName: (r.brand_name as string).trim(),
      isNew: r.is_new as boolean,
      defaultCategoryId: toMacroPrior(r.default_category_id),
    },
  };
}

// A proposed prior is advisory: an unknown id is dropped (null) rather than failing
// the parse, and a sub-category is rolled up to its macro (priors are macro-level).
function toMacroPrior(value: unknown): string | null {
  if (typeof value !== 'string' || !isValidCategoryId(value)) return null;
  return macroCategoryId(value);
}
