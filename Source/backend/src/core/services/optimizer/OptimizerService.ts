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

  async optimize(userId: string, role: UserRole, listId: string): Promise<OptimizationResult> {
    if (!hasPremiumAccess(role)) throw new PremiumRequiredError('route optimizer');

    const detail = await this.lists.getDetail(listId);
    if (!detail) throw new ListNotFoundError(listId);

    const items = detail.items
      .filter(item => item.productId)
      .map(item => ({ productId: item.productId as string, displayName: item.freeText }));
    const unresolved = detail.items.filter(item => !item.productId).map(item => item.freeText);

    // No home region → fall back to the contributor's own country, never a fixed metro.
    const context = await this.contributorContext.getContext(userId);
    const region = context.regionCode ?? context.countryCode;
    const matrix = await this.priceMatrix.build(items.map(item => item.productId), region);
    const config = await this.routing.get();

    return optimizeRoute({ items, unresolved, matrix, config, today: new Date().toISOString().slice(0, 10) });
  }
}
