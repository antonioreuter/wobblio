// §6.2 merchant catalog (global, no RLS). Writes go through the canonicalization /
// quarantine pipeline — never raw inserts from a handler.

export type AliasSource = 'SEED' | 'AUTO_FUZZY' | 'AUTO_LLM' | 'USER_CONFIRMED' | 'ADMIN';

export interface MerchantAliasMatch {
  merchantId: string;
  brandName: string;
  similarity: number; // 1 for an exact alias, pg_trgm score (0..1) for a fuzzy match
}

// Brand-level candidate offered to the LLM fallback so it can match an existing brand
// instead of declaring a new merchant when the alias search misses an over-captured header.
export interface MerchantBrandCandidate {
  merchantId: string;
  brandName: string;
}

export interface WriteMerchantAliasInput {
  merchantId: string;
  aliasRaw: string;
  aliasNormalized: string;
  countryCode: string;
  source: AliasSource;
}

export interface IMerchantCatalog {
  findExactAlias(normalized: string, countryCode: string): Promise<MerchantAliasMatch | null>;
  findFuzzyAliases(normalized: string, countryCode: string, limit: number): Promise<MerchantAliasMatch[]>;
  findBrandCandidates(normalized: string, countryCode: string, limit: number): Promise<MerchantBrandCandidate[]>;
  createProvisionalMerchant(brandName: string, countryCode: string, defaultCategoryId: string | null): Promise<string>;
  writeAlias(input: WriteMerchantAliasInput): Promise<void>;
  getDefaultCategory(merchantId: string): Promise<string | null>;
}
