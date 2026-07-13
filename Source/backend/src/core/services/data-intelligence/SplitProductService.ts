import type { IProductSplitRepository } from '@core/ports/data-intelligence/IProductSplitRepository';
import type { BaseUnit } from '@core/domain/unitSize';
import { ProductNotSplittableError } from '@core/domain/errors';

export interface SplitProductInput {
  productId: string;
  displayName: string;
  size: { packQuantity: number; baseUnit: BaseUnit } | null;
  // The caller's own invoice-line ids that belong to the new variant (they picked them from their
  // own purchase history). RLS scopes the move to the caller, so no cross-tenant leakage is possible.
  lineIds: string[];
}

// 09/05 user-driven split. NEVER automatic: it only runs from an explicit user action, and it only
// re-homes the user's OWN lines (RLS) plus writes USER_CONFIRMED aliases for future resolution. It
// does not retroactively touch other tenants' data or the de-identified observation store — those
// re-home naturally as future receipts resolve through the corrected aliases.
export class SplitProductService {
  constructor(private readonly repo: IProductSplitRepository) {}

  async split(input: SplitProductInput): Promise<string> {
    if (!input.displayName.trim()) throw new ProductNotSplittableError('a variant name is required');
    if (input.lineIds.length === 0) throw new ProductNotSplittableError('select at least one of your purchases for the new variant');

    const parent = await this.repo.getParent(input.productId);
    if (!parent) throw new ProductNotSplittableError('product not found');
    // Per-merchant identity (09/02): a variant belongs to the same merchant. A merchant-agnostic
    // legacy product can't be split until it's been stamped/split by the 09/03 migration.
    if (parent.merchantId === null) throw new ProductNotSplittableError('product has no merchant yet');

    const newProductId = await this.repo.cloneVariant({
      parentProductId: input.productId,
      merchantId: parent.merchantId,
      displayName: input.displayName.trim(),
      categoryId: parent.categoryId,
      baseUnit: input.size?.baseUnit ?? parent.baseUnit,
      countryCode: parent.countryCode,
      size: input.size,
    });

    const movedRawTexts = await this.repo.moveOwnLines(input.productId, newProductId, input.lineIds, input.size);
    if (movedRawTexts.length > 0) {
      await this.repo.writeConfirmedAliases(newProductId, parent.merchantId, movedRawTexts);
    }
    return newProductId;
  }
}
