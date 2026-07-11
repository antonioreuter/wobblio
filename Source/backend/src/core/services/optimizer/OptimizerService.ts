import type { IPriceMatrix } from '../../ports/optimizer/IPriceMatrix';
import type { IRoutingConfig } from '../../ports/optimizer/IRoutingConfig';
import type { IShoppingListRepository } from '../../ports/lists/IShoppingListRepository';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import { optimizeRoute, type OptimizationResult } from '../../domain/routeOptimizer';
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
    const matrix = await this.priceMatrix.build(items.map(item => item.productId), region, country, context.homeCurrency ?? 'EUR');
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

    return optimizeRoute({ items, unresolved, matrix: filteredMatrix, config, today: new Date().toISOString().slice(0, 10) });
  }
}
