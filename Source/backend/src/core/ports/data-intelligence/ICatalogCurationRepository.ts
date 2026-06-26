import type { MergeCompatibility } from '../../domain/catalogMerge';

// Provisional-catalog curation over the global merchant/product tables (no RLS).
// The provisional queues are read through SECURITY DEFINER helpers that count
// distinct contributing tenants cross-tenant (admin-console 06).
export type CatalogStatus = 'ACTIVE' | 'INACTIVE';

// Captured when a product merge applies, so a future un-merge / audit can see exactly
// what moved (de-identified observations are otherwise indistinguishable afterward).
export interface MergeProvenance {
  movedAliasIds: string[];
  movedObservationCount: number;
}

// A target product's aliases, for the operator to spot a poisoned one left by a bad
// merge (no stored alias embedding, so this is metadata for human review, not a score).
export interface ProductAliasInfo {
  id: string;
  aliasNormalized: string;
  merchantId: string | null;
  source: string;
  matchCount: number;
  lastSeenAt: string;
}

export interface ProvisionalEntity {
  id: string;
  name: string;
  subtitle: string | null; // merchant: country code · product: brand
  category: string | null; // product_category.name (merchant default / product category)
  aliases: string[]; // raw aliases that resolved to this entity
  tenantCount: number; // distinct tenants whose invoices reference it (sort key)
  observationCount: number; // non-quarantined price observations (§6.8 corroboration)
  lastSeenOn: string | null; // most recent non-quarantined observation date (ISO), for date sort
}

export type CurationSort = 'waiting' | 'name' | 'date';

// Server-side filtering for the curation queues: country is mandatory, region and
// category optional (the '__UNCAT__' sentinel selects entities with no category).
export interface QueueFilters {
  country: string;
  region: string | null;
  category: string | null;
  sort: CurationSort;
  limit: number;
  offset: number;
}

export interface CategoryCount { categoryId: string; categoryName: string; count: number; }
export interface CountryCount { countryCode: string; count: number; }
export interface RegionCount { regionCode: string; count: number; }

export interface ICatalogCurationRepository {
  listProvisionalMerchants(filters: QueueFilters): Promise<ProvisionalEntity[]>;
  listProvisionalProducts(filters: QueueFilters): Promise<ProvisionalEntity[]>;
  // Facets that drive the mandatory country selector, the per-category pie, and the
  // optional region selector — each counting only entities with provisional items.
  merchantCountries(): Promise<CountryCount[]>;
  productCountries(): Promise<CountryCount[]>;
  merchantCategories(country: string, region: string | null): Promise<CategoryCount[]>;
  productCategories(country: string, region: string | null): Promise<CategoryCount[]>;
  merchantRegions(country: string): Promise<RegionCount[]>;
  productRegions(country: string): Promise<RegionCount[]>;
  // Return false when the id does not exist (so the handler can 404).
  setMerchantStatus(id: string, status: CatalogStatus): Promise<boolean>;
  setProductStatus(id: string, status: CatalogStatus): Promise<boolean>;
  // Release born-quarantined observations once BOTH the entity and its counterpart are
  // ACTIVE (catalog promotion, §6.8). Status-aware: a product row still pending its
  // merchant (or vice-versa) stays quarantined.
  releaseProductObservations(productId: string): Promise<void>;
  releaseMerchantObservations(merchantId: string): Promise<void>;
  // Pull a rejected entity's observations out of serving. Reject → INACTIVE alone does
  // not affect the price index (which gates only on `quarantined`), so this is required
  // for reject to mean anything and to clean already-emitted bad data.
  quarantineProductObservations(productId: string): Promise<void>;
  quarantineMerchantObservations(merchantId: string): Promise<void>;
  // Retarget aliases + observations onto targetId and mark the source INACTIVE.
  // mergeMerchant returns false when either id is missing. mergeProduct returns the
  // moved-id provenance (B2), or null when either id is missing.
  mergeMerchant(sourceId: string, targetId: string): Promise<boolean>;
  mergeProduct(sourceId: string, targetId: string): Promise<MergeProvenance | null>;
  // Structural + semantic compatibility for a guarded product merge; null if either id
  // is missing. Drives both the server-side guard and the UI preview.
  getMergeCompatibility(sourceId: string, targetId: string): Promise<MergeCompatibility | null>;
  // Alias hygiene for remediating a poisoned product: list its aliases, deactivate
  // (delete) the one that does not belong so receipts stop resolving onto it.
  listProductAliases(productId: string): Promise<ProductAliasInfo[]>;
  deactivateAlias(aliasId: string): Promise<boolean>;
}
