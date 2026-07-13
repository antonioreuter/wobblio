import type { BaseUnit } from '@core/domain/unitSize';
import type { AliasSource } from '@core/ports/data-intelligence/IMerchantCatalog';

// §6.3 product catalog (global, no RLS). Exact merchant-scoped alias → pgvector
// cosine match → provisional creation, with alias write-back.

export interface ProductMatch {
  productId: string;
  categoryId: string;
  baseUnit: BaseUnit;
  packSizeBaseUnits: number | null;
  similarity: number; // cosine 0..1 for an embedding match; 1 for an exact alias
}

export interface CreateProvisionalProductInput {
  displayName: string;
  brand: string | null;
  categoryId: string;
  countryCode: string; // catalog is country-scoped (§ingestion); stamped from the resolved invoice location
  // Per-merchant identity (09/02): the product belongs to exactly this merchant. Null only for a
  // receipt whose merchant couldn't be resolved (rare legacy edge).
  merchantId: string | null;
  baseUnit: BaseUnit;
  packSizeBaseUnits: number | null;
  embedding: number[];
}

export interface WriteProductAliasInput {
  productId: string;
  aliasNormalized: string;
  merchantId: string | null;
  source: AliasSource;
}

export interface IProductCatalog {
  findExactAlias(merchantId: string | null, normalized: string, countryCode: string): Promise<ProductMatch | null>;
  // Candidate search is scoped to the SAME merchant (09/02): the ≥0.92 cross-merchant acceptance is
  // removed, so a physically identical item at another store is never silently merged.
  searchByEmbedding(merchantId: string | null, embedding: number[], categoryId: string | null, countryCode: string, limit: number): Promise<ProductMatch[]>;
  createProvisionalProduct(input: CreateProvisionalProductInput): Promise<string>;
  writeAlias(input: WriteProductAliasInput): Promise<void>;
}
