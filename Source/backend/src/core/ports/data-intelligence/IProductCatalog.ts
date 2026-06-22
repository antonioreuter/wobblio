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
  findExactAlias(merchantId: string | null, normalized: string): Promise<ProductMatch | null>;
  searchByEmbedding(embedding: number[], categoryId: string | null, limit: number): Promise<ProductMatch[]>;
  createProvisionalProduct(input: CreateProvisionalProductInput): Promise<string>;
  writeAlias(input: WriteProductAliasInput): Promise<void>;
}
