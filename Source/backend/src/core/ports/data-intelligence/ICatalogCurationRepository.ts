// Provisional-catalog curation over the global merchant/product tables (no RLS).
// The provisional queues are read through SECURITY DEFINER helpers that count
// distinct contributing tenants cross-tenant (admin-console 06).
export type CatalogStatus = 'ACTIVE' | 'INACTIVE';

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
  // Retarget aliases + observations onto targetId and mark the source INACTIVE.
  // Returns false when either id is missing.
  mergeMerchant(sourceId: string, targetId: string): Promise<boolean>;
  mergeProduct(sourceId: string, targetId: string): Promise<boolean>;
}
