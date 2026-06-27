import type { BaseUnit } from '@core/domain/unitSize';

export interface ProductSearchResult {
  productId: string;
  displayName: string;
  brand: string | null;
  categoryId: string;
  baseUnit: BaseUnit;
  packSizeBaseUnits: number | null;
  // Merchant signal per compare mode: name when exactly one store carries it, else a count.
  ownMerchantCount: number;
  ownMerchantName: string | null;
  marketMerchantCount: number;
  marketMerchantName: string | null;
}

// §10 autocomplete: ACTIVE global products ∪ the tenant's own PROVISIONAL products
// (the latter scoped via the caller's RLS-visible invoice lines). `countryCode`/`regionCode`
// scope the market merchant signal to the same region the trends chart serves; pass '' to
// count market merchants globally.
export interface IProductSearch {
  search(
    query: string,
    limit: number,
    countryCode: string,
    regionCode: string,
  ): Promise<ProductSearchResult[]>;
}
