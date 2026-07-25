import type { IPriceMatrix } from '../../ports/optimizer/IPriceMatrix';
import type { IRoutingConfig } from '../../ports/optimizer/IRoutingConfig';
import type { IShoppingListRepository } from '../../ports/lists/IShoppingListRepository';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import { optimizeRoute, type OptimizationResult, type PriceMatrix } from '../../domain/routeOptimizer';
import type { ComparabilityReason } from '../../domain/comparability';
import { hasPremiumAccess } from '../../domain/access';
import { PremiumRequiredError, ListNotFoundError } from '../../domain/errors';

export class OptimizerService {
  constructor(
    private readonly lists: IShoppingListRepository,
    private readonly priceMatrix: IPriceMatrix,
    private readonly routing: IRoutingConfig,
    private readonly contributorContext: IContributorContextRepository,
  ) {}

  async optimize(
    userId: string,
    role: UserRole,
    listId: string,
    excludedMerchantIds: string[] = [],
  ): Promise<OptimizationResult> {
    if (!hasPremiumAccess(role)) throw new PremiumRequiredError('route optimizer');

    const detail = await this.lists.getDetail(listId);
    if (!detail) throw new ListNotFoundError(listId);

    const items = detail.items
      .filter(item => item.productId)
      .map(item => ({ productId: item.productId as string, displayName: item.freeText, quantity: item.quantity }));
    const unresolved = detail.items.filter(item => !item.productId).map(item => item.freeText);

    // List override (§10b Premium region override) wins; otherwise fall back to the
    // contributor's own profile region, then country — never a fixed metro. Country and the
    // view currency (the contributor's home currency) scope the matrix to one currency so a
    // country-based list is never priced by blending, say, BRL and EUR observations.
    const context = await this.contributorContext.getContext(userId);
    const region = detail.regionCode ?? detail.countryCode ?? context.regionCode ?? context.countryCode;
    const country = detail.countryCode ?? context.countryCode;
    const currency = context.homeCurrency ?? 'EUR';
    const { matrix, reasons } = await this.priceMatrix.build(items.map(item => item.productId), region, country, currency);
    const config = await this.routing.get();

    // §10c store removal: excluded merchants are dropped from the candidate set
    // before the algorithm runs, so the existing baseline/cheapest-store logic
    // naturally reallocates every affected item to the next-best remaining store.
    const excluded = new Set(excludedMerchantIds);
    const filteredMatrix = excluded.size === 0 ? matrix : {
      ...matrix,
      merchants: matrix.merchants.filter(m => !excluded.has(m.id)),
      cells: matrix.cells.filter(c => !excluded.has(c.merchantId)),
    };

    const result = optimizeRoute({ items, unresolved, matrix: filteredMatrix, config, today: new Date().toISOString().slice(0, 10) });
    annotateReasons(result, reasons);

    // 09/05 degradation ladder, bottom rung: when no item is priceable at ≥2 merchants (no usable
    // cross-store links), split-route can't help — fall back to own-history whole-basket totals per
    // merchant, clearly own-history-based, so the user still sees something actionable.
    if (!hasCrossStoreOption(filteredMatrix)) {
      const basket = await this.priceMatrix.ownHistoryBasket(items.map(item => item.productId), currency);
      result.ownHistoryBasket = basket.length > 0 ? basket : null;
      if (basket.length > 0) {
        result.reason = 'own-history basket totals — link items across stores to unlock split suggestions';
      }
    } else {
      result.ownHistoryBasket = null;
    }
    return result;
  }
}

// Stamp each served line with why its linked siblings were considered (09/05), so the UI
// can explain instead of silently omitting. Pure post-processing; the optimizer stays unchanged.
function annotateReasons(result: OptimizationResult, reasons: Record<string, ComparabilityReason>): void {
  for (const store of result.stores) {
    for (const line of store.lines) {
      line.reason = reasons[line.productId] ?? 'no_link';
    }
  }
}

// A basket has a real split-route option only when some product is priceable at ≥2 merchants.
function hasCrossStoreOption(matrix: PriceMatrix): boolean {
  const merchantsByProduct = new Map<string, Set<string>>();
  for (const cell of matrix.cells) {
    const set = merchantsByProduct.get(cell.productId) ?? new Set<string>();
    set.add(cell.merchantId);
    merchantsByProduct.set(cell.productId, set);
  }
  for (const set of merchantsByProduct.values()) if (set.size >= 2) return true;
  return false;
}
