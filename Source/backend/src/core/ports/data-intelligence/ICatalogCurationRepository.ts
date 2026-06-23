// Provisional-catalog curation over the global merchant/product tables (no RLS).
// The provisional queues are read through SECURITY DEFINER helpers that count
// distinct contributing tenants cross-tenant (admin-console 06).
export type CatalogStatus = 'ACTIVE' | 'INACTIVE';

export interface ProvisionalEntity {
  id: string;
  name: string;
  subtitle: string | null; // merchant: country code · product: brand
  aliases: string[]; // raw aliases that resolved to this entity
  tenantCount: number; // distinct tenants whose invoices reference it (sort key)
  observationCount: number; // non-quarantined price observations (§6.8 corroboration)
}

export interface ICatalogCurationRepository {
  listProvisionalMerchants(): Promise<ProvisionalEntity[]>;
  listProvisionalProducts(): Promise<ProvisionalEntity[]>;
  // Return false when the id does not exist (so the handler can 404).
  setMerchantStatus(id: string, status: CatalogStatus): Promise<boolean>;
  setProductStatus(id: string, status: CatalogStatus): Promise<boolean>;
  // Retarget aliases + observations onto targetId and mark the source INACTIVE.
  // Returns false when either id is missing.
  mergeMerchant(sourceId: string, targetId: string): Promise<boolean>;
  mergeProduct(sourceId: string, targetId: string): Promise<boolean>;
}
