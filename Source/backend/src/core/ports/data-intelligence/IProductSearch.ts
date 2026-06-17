import type { BaseUnit } from '@core/domain/unitSize';

export interface ProductSearchResult {
  productId: string;
  displayName: string;
  brand: string | null;
  categoryId: string;
  baseUnit: BaseUnit;
  packSizeBaseUnits: number | null;
}

// §10 autocomplete: ACTIVE global products ∪ the tenant's own PROVISIONAL products
// (the latter scoped via the caller's RLS-visible invoice lines).
export interface IProductSearch {
  search(query: string, limit: number): Promise<ProductSearchResult[]>;
}
