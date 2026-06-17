import type { IProductSearch, ProductSearchResult } from '../../ports/data-intelligence/IProductSearch';

const MIN_QUERY_LENGTH = 2;
const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 10;

export class ProductSearchService {
  constructor(private readonly products: IProductSearch) {}

  // Short queries return nothing (trigram noise); the limit is clamped to MAX_LIMIT.
  async search(query: string, limit = DEFAULT_LIMIT): Promise<ProductSearchResult[]> {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return [];
    return this.products.search(q, Math.min(Math.max(1, limit), MAX_LIMIT));
  }
}
