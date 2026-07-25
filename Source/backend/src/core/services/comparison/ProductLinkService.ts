import type {
  AcceptedProductLink,
  IProductLinkRepository,
  ProductLinkStatus,
} from '@core/ports/comparison/IProductLinkRepository';
import { InvalidProductLinkError } from '@core/domain/errors';
import { isUuid } from '@core/domain/uuid';

// Fix 10 — product-link mutations from the trend report's suggestion chips. Links are symmetric, so
// the service canonicalizes the pair (product_a_id < product_b_id) before every call: accepting or
// dismissing A↔B is identical to B↔A, and one stored row serves both directions. Tenant-scoped and
// RLS-protected at the adapter — one user's links never affect another's comparisons or the global
// price store.
export class ProductLinkService {
  constructor(private readonly repo: IProductLinkRepository) {}

  // ACCEPTED links among the given products (both endpoints selected) — drives the trend report's
  // size-confirm affordance. Ignores malformed ids rather than failing the whole read.
  linksAmong(productIds: string[]): Promise<AcceptedProductLink[]> {
    const valid = [...new Set(productIds.filter(isUuid))];
    if (valid.length < 2) return Promise.resolve([]);
    return this.repo.acceptedLinksAmong(valid);
  }

  // Tap "+ add" on a suggestion → ACCEPTED (plotted, and rankable subject to the comparability rule
  // 09/05). Tap "✕" → DISMISSED (never suggested again, both directions).
  async setStatus(selfProductId: string, otherProductId: string, status: ProductLinkStatus): Promise<void> {
    const [a, b] = this.canonicalPair(selfProductId, otherProductId);
    await this.repo.upsert(a, b, status);
  }

  // "Same size?" confirmed on a plotted pair. The sole override to the comparability rule (09/05):
  // a size-equivalent link becomes crown/optimizer eligible. Rejects a pair that was never linked.
  async setSizeEquivalent(selfProductId: string, otherProductId: string, sizeEquivalent: boolean): Promise<void> {
    const [a, b] = this.canonicalPair(selfProductId, otherProductId);
    const updated = await this.repo.setSizeEquivalent(a, b, sizeEquivalent);
    if (!updated) throw new InvalidProductLinkError('no such link to update');
  }

  private canonicalPair(selfProductId: string, otherProductId: string): [string, string] {
    if (!isUuid(selfProductId) || !isUuid(otherProductId)) {
      throw new InvalidProductLinkError('both product ids are required');
    }
    if (selfProductId === otherProductId) {
      throw new InvalidProductLinkError('cannot link a product to itself');
    }
    return selfProductId < otherProductId ? [selfProductId, otherProductId] : [otherProductId, selfProductId];
  }
}
