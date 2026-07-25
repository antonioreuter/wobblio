import type { BaseUnit } from '@core/domain/unitSize';

// Fix 10 — read model for the trend report's counterpart suggestions. Reads the global catalog
// (product/merchant/price_observation) plus the caller's RLS-scoped product_link, so tenant context
// MUST be set (withTenantTx) before calling. Returns same-category, cross-merchant products that are
// actually tracked in the picker's region, each carrying its similarity signals and link state; the
// domain ranker (counterpartSuggestion.ts) decides which to surface. DISMISSED links are excluded here.

export interface CounterpartCandidateInput {
  productId: string; // the anchor product the user just selected
  countryCode: string; // ISO 3166-1 alpha-2
  regionCode: string; // ISO 3166-2 — only counterparts tracked in this region are candidates
  weeks: number; // trailing observation window
}

export interface CounterpartCandidateRow {
  productId: string;
  displayName: string;
  brand: string | null;
  merchantId: string | null;
  merchantName: string | null;
  packSizeBaseUnits: number | null;
  baseUnit: BaseUnit | null;
  embeddingSimilarity: number | null; // cosine in [0,1]; null when either embedding is absent
  nameSimilarity: number; // pg_trgm similarity in [0,1]
  linked: boolean; // an ACCEPTED product_link already ties this candidate to the anchor
}

export interface ICounterpartCandidateQuery {
  candidates(input: CounterpartCandidateInput): Promise<CounterpartCandidateRow[]>;
}
