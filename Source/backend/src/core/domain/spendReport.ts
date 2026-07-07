// Domain shapes for the hierarchical spend-breakdown report (category → merchant →
// item-category → items). Line-rooted: every level sums `invoice_line.line_total`
// converted to the caller's home currency, so a level's node amounts always sum to
// the parent's total. See SpendReportService for assembly and gating.

export type SpendReportLevel = 'categories' | 'merchants' | 'item-categories' | 'items';

// Sentinels for the SQL group keys that have no id (a line with no category / an
// invoice with no resolved merchant). The client renders these as labelled buckets
// and can still drill through them.
export const UNCATEGORIZED_ID = 'uncategorized';
export const UNKNOWN_MERCHANT_ID = 'unknown-merchant';

// One occurrence of an item within an L4 group (same product bought on several trips).
export interface SpendOccurrence {
  date: string; // yyyy-mm-dd (transaction date, else upload date)
  invoiceId: string;
  quantity: number;
  amount: number; // home currency, signed
}

// A single row at any drill level. `amount` is home-currency and signed (discounts
// net negative). `pct` is the share of this level's total. Optional fields are
// populated per level (merchants carry invoiceCount/lastPurchasedOn; items carry
// quantity/occurrences).
export interface SpendNode {
  id: string;
  name: string;
  amount: number;
  pct: number;
  count: number; // line count (or, for merchants, contributing line count)
  invoiceCount?: number;
  lastPurchasedOn?: string | null;
  quantity?: number;
  occurrences?: SpendOccurrence[];
}

export interface SpendReportResponse {
  level: SpendReportLevel;
  currency: string | null; // caller's home currency; null only when unresolved
  total: number; // sum of node amounts at this level
  nodes: SpendNode[];
  // Echoed drill context so the client can render breadcrumbs without re-deriving names.
  categoryId?: string | null;
  categoryName?: string | null;
  merchantId?: string | null;
  merchantName?: string | null;
  itemCategoryId?: string | null;
  itemCategoryName?: string | null;
}
