import type { BaseUnit } from '@core/domain/unitSize';

// 09/05 — user-driven product-split resolution. When one product name at a merchant covers two
// physically different SKUs (bimodal price history → price-ambiguous), the USER can split it: the
// user picks which of their own purchases belong to the new variant. Auto-split is forbidden — this
// only ever runs from an explicit user action. A new product is cloned at the SAME merchant
// (per-merchant identity, 09/02), the user's identified lines are re-homed to it with a
// user-annotated size, and USER_CONFIRMED merchant-scoped aliases guide future resolution.

export interface ParentProductInfo {
  merchantId: string | null;
  displayName: string;
  categoryId: string;
  baseUnit: BaseUnit;
  countryCode: string;
}

export interface CloneVariantInput {
  parentProductId: string;
  merchantId: string;
  displayName: string;
  categoryId: string;
  baseUnit: BaseUnit;
  countryCode: string;
  size: { packQuantity: number; baseUnit: BaseUnit } | null;
}

export interface IProductSplitRepository {
  // Parent product (global catalog, no RLS). Null when it doesn't exist.
  getParent(productId: string): Promise<ParentProductInfo | null>;
  // Clone the parent at the same merchant as a USER-created PROVISIONAL variant (copying the
  // parent's embedding so it still participates in matching). Returns the new product id.
  cloneVariant(input: CloneVariantInput): Promise<string>;
  // Re-home ONLY the caller's own invoice lines (RLS-scoped — tenant context MUST be set) whose id
  // is in lineIds and which currently point at the parent, onto the new product, stamping the
  // user-annotated size (size_source = USER). Returns the distinct raw texts actually moved.
  moveOwnLines(
    parentProductId: string,
    newProductId: string,
    lineIds: string[],
    size: { packQuantity: number; baseUnit: BaseUnit } | null,
  ): Promise<string[]>;
  // Write USER_CONFIRMED merchant-scoped aliases for the moved raw texts, so future receipts at
  // this merchant resolve to the corrected variant (global observations re-home over time).
  writeConfirmedAliases(newProductId: string, merchantId: string, rawTexts: string[]): Promise<void>;
}
