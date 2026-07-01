import type { IProductSearch, ProductSearchResult } from '../../ports/data-intelligence/IProductSearch';

const MIN_QUERY_LENGTH = 2;
const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 10;

export class ProductSearchService {
  constructor(private readonly products: IProductSearch) {}

  // Short queries return nothing (trigram noise); the limit is clamped to MAX_LIMIT.
  // country/region scope the market merchant signal to the served region ('' = global).
  // categoryIds (§10b) restricts results to a shopping list's locked category macro.
  async search(
    query: string,
    limit = DEFAULT_LIMIT,
    countryCode = '',
    regionCode = '',
    categoryIds?: string[],
  ): Promise<ProductSearchResult[]> {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return [];
    return this.products.search(q, Math.min(Math.max(1, limit), MAX_LIMIT), countryCode, regionCode, categoryIds);
  }
}
