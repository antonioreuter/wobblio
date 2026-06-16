// §6.2 merchant catalog (global, no RLS). Writes go through the canonicalization /
// quarantine pipeline — never raw inserts from a handler.

export type AliasSource = 'SEED' | 'AUTO_FUZZY' | 'AUTO_LLM' | 'USER_CONFIRMED' | 'ADMIN';

export interface MerchantAliasMatch {
  merchantId: string;
  branchId: string | null;
  brandName: string;
  similarity: number; // 1 for an exact alias, pg_trgm score (0..1) for a fuzzy match
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
  createProvisionalMerchant(brandName: string, countryCode: string): Promise<string>;
  writeAlias(input: WriteMerchantAliasInput): Promise<void>;
  getDefaultCategory(merchantId: string): Promise<string | null>;
}
