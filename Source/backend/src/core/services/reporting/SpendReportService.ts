import type { ISpendReportQuery, SpendReportFilter } from '@core/ports/reporting/ISpendReportQuery';
import {
  UNCATEGORIZED_ID,
  UNKNOWN_MERCHANT_ID,
  type SpendNode,
  type SpendReportResponse,
  type SpendReportView,
} from '@core/domain/spendReport';
import { resolvePeriod, type SpendPeriodPreset } from '@core/domain/reportPeriod';
import { categoryNameFor } from '@core/domain/categoryTaxonomy';
import { PremiumRequiredError, InvalidSpendReportQueryError } from '@core/domain/errors';
import { isUuid } from '@core/domain/uuid';

// merchantId is bound to a ::uuid cast in SQL, so a malformed value must be rejected as a 400
// here rather than exploding as a Postgres 22P02 (surfacing as an opaque 500). The
// UNKNOWN_MERCHANT_ID sentinel is the one allowed non-UUID value.

// The raw request the route parses from the query string. Which drill level runs is
// inferred from which selection fields are present (see `report`).
export interface SpendReportParams {
  preset: SpendPeriodPreset;
  from: string | null;
  to: string | null;
  country: string;
  region: string;
  view: SpendReportView;
  categoryId: string | null;
  merchantId: string | null;
  itemCategoryId: string | null;
}

const UNCATEGORIZED_LABEL = 'Uncategorized';
const UNKNOWN_MERCHANT_LABEL = 'Unknown merchant';

// Assembles the hierarchical spend report from the RLS-scoped aggregation port. Owns the
// two policies that must live in the domain: the 90-day window cap (via resolvePeriod) and
// the premium gate on item-level drill-down (any request carrying a merchantId → L3/L4).
export class SpendReportService {
  constructor(private readonly query: ISpendReportQuery) {}

  async report(
    params: SpendReportParams,
    isPremium: boolean,
    homeCurrency: string | null,
  ): Promise<SpendReportResponse> {
    const window = resolvePeriod(params.preset, params.from, params.to);
    const filter: SpendReportFilter = {
      from: window.from,
      to: window.to,
      country: params.country,
      region: params.region,
    };

    if (params.view === 'product') return this.reportByProduct(params, filter, isPremium, homeCurrency);
    return this.reportByMerchant(params, filter, isPremium, homeCurrency);
  }

  // Store-centric drill: category → merchant → item-category → items. The premium boundary is
  // drilling into a merchant (a bare merchantId with no category resolves to the open L1 level,
  // so it must not trigger a false 403).
  private async reportByMerchant(
    params: SpendReportParams,
    filter: SpendReportFilter,
    isPremium: boolean,
    homeCurrency: string | null,
  ): Promise<SpendReportResponse> {
    if (
      params.merchantId &&
      params.merchantId !== UNKNOWN_MERCHANT_ID &&
      !isUuid(params.merchantId)
    ) {
      throw new InvalidSpendReportQueryError('merchantId must be a valid merchant id');
    }
    if (params.categoryId && params.merchantId && !isPremium) {
      throw new PremiumRequiredError('item-level spend breakdown');
    }

    if (!params.categoryId) return this.categories(filter, homeCurrency);
    if (!params.merchantId) return this.merchants(params.categoryId, filter, homeCurrency);
    if (!params.itemCategoryId) {
      return this.itemCategories(params.categoryId, params.merchantId, filter, homeCurrency);
    }
    return this.items(params.categoryId, params.merchantId, params.itemCategoryId, filter, homeCurrency);
  }

  // Product-centric drill: category → item-category → items, aggregated across all stores. The
  // premium boundary is the grouped-product leaf; free users see category + item-category.
  private async reportByProduct(
    params: SpendReportParams,
    filter: SpendReportFilter,
    isPremium: boolean,
    homeCurrency: string | null,
  ): Promise<SpendReportResponse> {
    if (params.categoryId && params.itemCategoryId && !isPremium) {
      throw new PremiumRequiredError('item-level spend breakdown');
    }

    if (!params.categoryId) return this.categories(filter, homeCurrency);
    if (!params.itemCategoryId) return this.itemCategories(params.categoryId, null, filter, homeCurrency);
    return this.items(params.categoryId, null, params.itemCategoryId, filter, homeCurrency);
  }

  private async categories(filter: SpendReportFilter, currency: string | null): Promise<SpendReportResponse> {
    const rows = await this.query.categories(filter);
    const total = sum(rows.map((r) => r.amount));
    const nodes: SpendNode[] = rows.map((r) => ({
      id: r.macroId ?? UNCATEGORIZED_ID,
      name: categoryNameFor(r.macroId) ?? UNCATEGORIZED_LABEL,
      amount: r.amount,
      pct: share(r.amount, total),
      count: r.lineCount,
    }));
    return { level: 'categories', currency, total, nodes };
  }

  private async merchants(
    categoryId: string,
    filter: SpendReportFilter,
    currency: string | null,
  ): Promise<SpendReportResponse> {
    const rows = await this.query.merchants(categoryId, filter);
    const total = sum(rows.map((r) => r.amount));
    const nodes: SpendNode[] = rows.map((r) => ({
      id: r.merchantId ?? UNKNOWN_MERCHANT_ID,
      name: r.merchantName ?? UNKNOWN_MERCHANT_LABEL,
      amount: r.amount,
      pct: share(r.amount, total),
      count: r.lineCount,
      invoiceCount: r.invoiceCount,
      lastPurchasedOn: r.lastPurchasedOn,
    }));
    return {
      level: 'merchants',
      currency,
      total,
      nodes,
      categoryId,
      categoryName: labelFor(categoryId),
    };
  }

  private async itemCategories(
    categoryId: string,
    merchantId: string | null,
    filter: SpendReportFilter,
    currency: string | null,
  ): Promise<SpendReportResponse> {
    const rows = await this.query.itemCategories(categoryId, merchantId, filter);
    const total = sum(rows.map((r) => r.amount));
    const nodes: SpendNode[] = rows.map((r) => ({
      id: r.categoryId ?? UNCATEGORIZED_ID,
      name: categoryNameFor(r.categoryId) ?? UNCATEGORIZED_LABEL,
      amount: r.amount,
      pct: share(r.amount, total),
      count: r.lineCount,
    }));
    return {
      level: 'item-categories',
      currency,
      total,
      nodes,
      categoryId,
      categoryName: labelFor(categoryId),
      merchantId,
    };
  }

  private async items(
    categoryId: string,
    merchantId: string | null,
    itemCategoryId: string,
    filter: SpendReportFilter,
    currency: string | null,
  ): Promise<SpendReportResponse> {
    const rows = await this.query.items(merchantId, itemCategoryId, filter);
    const total = sum(rows.map((r) => r.amount));
    const nodes: SpendNode[] = rows.map((r) => ({
      id: r.groupKey,
      name: r.name,
      amount: r.amount,
      pct: share(r.amount, total),
      count: r.lineCount,
      quantity: r.quantity,
      occurrences: r.occurrences,
    }));
    return {
      level: 'items',
      currency,
      total,
      nodes,
      categoryId,
      categoryName: labelFor(categoryId),
      merchantId,
      itemCategoryId,
      itemCategoryName: labelFor(itemCategoryId),
    };
  }
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

// Share of the level total, as a 0–100 percentage. Guards a zero (or net-zero) total so
// a discount-only bucket doesn't produce NaN/Infinity.
function share(amount: number, total: number): number {
  return total === 0 ? 0 : (amount / total) * 100;
}

function labelFor(categoryId: string): string {
  if (categoryId === UNCATEGORIZED_ID) return UNCATEGORIZED_LABEL;
  return categoryNameFor(categoryId) ?? categoryId;
}
