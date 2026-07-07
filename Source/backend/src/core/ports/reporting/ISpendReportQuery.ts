import type { SpendOccurrence } from '@core/domain/spendReport';
import type { SpendWindow } from '@core/domain/reportPeriod';

// The date/region window every drill level is filtered by. `region` empty ⇒ "all regions"
// (no location filter). `country` accompanies a non-empty region (RegionPicker supplies both).
export interface SpendReportFilter extends SpendWindow {
  country: string;
  region: string;
}

// Raw aggregation rows returned by the adapter — no `pct` (the service computes shares
// from the level total). Amounts are already home-currency and signed.
export interface CategoryAmountRow {
  macroId: string | null; // null ⇒ uncategorized
  amount: number;
  lineCount: number;
}

export interface MerchantAmountRow {
  merchantId: string | null; // null ⇒ no resolved merchant
  merchantName: string | null;
  amount: number;
  lineCount: number;
  invoiceCount: number;
  lastPurchasedOn: string | null;
}

export interface ItemCategoryAmountRow {
  categoryId: string | null; // leaf or macro id; null ⇒ uncategorized
  amount: number;
  lineCount: number;
}

export interface ItemAmountRow {
  groupKey: string;
  name: string;
  quantity: number;
  amount: number;
  lineCount: number;
  occurrences: SpendOccurrence[];
}

// Read-only aggregation over the caller's RLS-scoped invoices. The db MUST already carry
// the tenant context (see withTenantTx). `macroId`/`merchantId`/`itemCategoryId` accept the
// UNCATEGORIZED_ID / UNKNOWN_MERCHANT_ID sentinels for the null-key buckets.
export interface ISpendReportQuery {
  categories(filter: SpendReportFilter): Promise<CategoryAmountRow[]>;
  merchants(macroId: string, filter: SpendReportFilter): Promise<MerchantAmountRow[]>;
  itemCategories(macroId: string, merchantId: string, filter: SpendReportFilter): Promise<ItemCategoryAmountRow[]>;
  items(
    merchantId: string,
    itemCategoryId: string,
    filter: SpendReportFilter,
  ): Promise<ItemAmountRow[]>;
}
