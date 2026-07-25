// §6.5.3 split-route optimizer (pure domain). Builds a single-best-store baseline,
// the unconstrained per-product minimum, and — when the gap clears the SSM split
// threshold — a greedy ≤max_stores partition with a €1.50 marginal-merge rule.

export const MARGINAL_SAVING_THRESHOLD = 1.5;

export interface OptimizerConfig {
  minSplitSaving: number;
  maxStores: number;
}

export interface MerchantRef {
  id: string;
  name: string;
}

export interface PriceCell {
  productId: string;
  merchantId: string;
  price: number;
  observationCount: number;
  lastObservedOn: string;
}

export interface PriceMatrix {
  merchants: MerchantRef[];
  cells: PriceCell[];
  userAverages: Record<string, number>;
}

export interface OptimizerItem {
  productId: string;
  displayName: string;
  quantity: number;
}

export interface OptimizeInput {
  items: OptimizerItem[];
  unresolved: string[];
  matrix: PriceMatrix;
  config: OptimizerConfig;
  today: string;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface StoreLine {
  productId: string;
  displayName: string;
  expectedPrice: number;
  quantity: number;
  lineTotal: number;
  observationCount: number;
  lastObservedOn: string | null;
  confidence: Confidence;
  // 09/05: why this item's linked siblings were (or weren't) considered — set by
  // OptimizerService after the pure algorithm runs, so the UI can explain instead of silently
  // omitting. The pure optimizer never populates it.
  reason?: 'comparable' | 'watch_only' | 'ambiguous' | 'no_link';
}

export interface StoreSubList {
  merchantId: string;
  name: string;
  isPrimary: boolean;
  subtotal: number;
  lines: StoreLine[];
}

// 09/05 degradation ladder, bottom rung: with zero usable cross-store links, split-route can't
// help, so we fall back to the tenant's own-history whole-basket total per merchant they shop at
// ("your usual basket costs ~€52 at AH vs ~€49 at Jumbo"). Clearly own-history-based, never crowned.
export interface OwnHistoryBasketTotal {
  merchantId: string;
  name: string;
  total: number;
  itemsPriced: number; // how many basket items this merchant's own history could price
}

export interface OptimizationResult {
  optimized: boolean;
  baseline: { merchantId: string; name: string; total: number } | null;
  totalExpectedSaving: number;
  stores: StoreSubList[];
  unresolvedItems: string[];
  reason: string | null;
  // Populated by OptimizerService only in the zero-usable-links fallback (09/05); null otherwise.
  ownHistoryBasket?: OwnHistoryBasketTotal[] | null;
}

interface Assignment {
  merchantId: string;
  price: number;
  cell: PriceCell | null;
}

interface Ctx {
  cellMap: Map<string, PriceCell>;
  nameOf: Map<string, string>;
  priceAt: (productId: string, merchantId: string) => number;
  // Real observed price (no fallback) — undefined when the store has no cell for it.
  realPriceAt: (productId: string, merchantId: string) => number | undefined;
  today: string;
}

const key = (productId: string, merchantId: string): string => `${productId}|${merchantId}`;
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function optimizeRoute(input: OptimizeInput): OptimizationResult {
  const { matrix, config } = input;
  const priceable = input.items.filter(it => isPriceable(it.productId, matrix));
  const unresolved = [
    ...input.unresolved,
    ...input.items.filter(it => !isPriceable(it.productId, matrix)).map(it => it.displayName),
  ];

  if (matrix.merchants.length === 0 || priceable.length === 0) {
    return emptyResult(unresolved);
  }

  const ctx = buildCtx(matrix, input.today);
  const baseline = bestStore(matrix.merchants, priceable, ctx.priceAt);
  const assignments = priceable.map(it => assignCheapest(it, matrix, ctx.cellMap, baseline.merchantId));
  const assignedTotal = sum(assignments.map((a, i) => a.price * priceable[i].quantity));
  const saving = round2(baseline.total - assignedTotal);

  if (saving <= config.minSplitSaving) {
    return singleStore(baseline, priceable, ctx, unresolved, saving > 0 ? 'saving below split threshold' : 'no saving available');
  }
  return split(baseline, priceable, assignments, config, ctx, unresolved);
}

function buildCtx(matrix: PriceMatrix, today: string): Ctx {
  const cellMap = new Map(matrix.cells.map(c => [key(c.productId, c.merchantId), c]));
  const nameOf = new Map(matrix.merchants.map(m => [m.id, m.name]));
  const priceAt = (productId: string, merchantId: string): number =>
    cellMap.get(key(productId, merchantId))?.price ?? fallbackPrice(productId, matrix);
  const realPriceAt = (productId: string, merchantId: string): number | undefined =>
    cellMap.get(key(productId, merchantId))?.price;
  return { cellMap, nameOf, priceAt, realPriceAt, today };
}

function isPriceable(productId: string, matrix: PriceMatrix): boolean {
  return matrix.cells.some(c => c.productId === productId) || matrix.userAverages[productId] !== undefined;
}

// Missing cell → user's historical average, else the product's best-known price.
// Only called for priceable products, so a userAverage or ≥1 cell always exists.
function fallbackPrice(productId: string, matrix: PriceMatrix): number {
  const avg = matrix.userAverages[productId];
  if (avg !== undefined) return avg;
  const prices = matrix.cells.filter(c => c.productId === productId).map(c => c.price);
  return Math.min(...prices);
}

function bestStore(
  merchants: MerchantRef[],
  priceable: OptimizerItem[],
  priceAt: Ctx['priceAt'],
): { merchantId: string; name: string; total: number } {
  const totals = merchants.map(m => ({
    merchantId: m.id,
    name: m.name,
    total: sum(priceable.map(it => priceAt(it.productId, m.id) * it.quantity)),
  }));
  return totals.reduce((a, b) => (b.total < a.total ? b : a));
}

// Cheapest store with a real observation for the product; userAverage-only
// products have no cheaper store, so they ride with the main basket.
function assignCheapest(
  item: OptimizerItem,
  matrix: PriceMatrix,
  cellMap: Map<string, PriceCell>,
  mainId: string,
): Assignment {
  const cells = matrix.merchants
    .map(m => cellMap.get(key(item.productId, m.id)))
    .filter((c): c is PriceCell => Boolean(c));
  if (cells.length === 0) return { merchantId: mainId, price: fallbackPrice(item.productId, matrix), cell: null };
  const best = cells.reduce((a, b) => (b.price < a.price ? b : a));
  return { merchantId: best.merchantId, price: best.price, cell: best };
}

interface SecondaryGroup {
  merchantId: string;
  name: string;
  items: OptimizerItem[];
  saving: number;
  // True when at least one item has no cell at the main store, so it cannot fall
  // back there — the group must stay a separate stop (never merged into main).
  pinned: boolean;
}

function split(
  baseline: { merchantId: string; name: string; total: number },
  priceable: OptimizerItem[],
  assignments: Assignment[],
  config: OptimizerConfig,
  ctx: Ctx,
  unresolved: string[],
): OptimizationResult {
  const secondaries = groupSecondaries(priceable, assignments, baseline.merchantId, ctx);
  const kept = selectKept(secondaries, config.maxStores);
  const keptIds = new Set(kept.map(s => s.merchantId));

  // Dropped groups are never pinned, so every one of their items has a real main
  // cell — falling them back to main never lists a phantom price.
  const mainItems = priceable.filter((_, i) => !keptIds.has(assignments[i].merchantId));
  const stores = [
    buildStore(baseline.merchantId, baseline.name, true, mainItems, ctx),
    ...kept.map(s => buildStore(s.merchantId, s.name, false, s.items, ctx)),
  ];
  const total = round2(sum(stores.map(s => s.subtotal)));

  return {
    optimized: kept.length > 0,
    baseline: { merchantId: baseline.merchantId, name: baseline.name, total: round2(baseline.total) },
    totalExpectedSaving: round2(baseline.total - total),
    stores,
    unresolvedItems: unresolved,
    reason: kept.length > 0 ? null : 'splits below marginal threshold',
  };
}

function groupSecondaries(
  priceable: OptimizerItem[],
  assignments: Assignment[],
  mainId: string,
  ctx: Ctx,
): SecondaryGroup[] {
  const groups = new Map<string, SecondaryGroup>();
  priceable.forEach((item, i) => {
    const a = assignments[i];
    if (a.merchantId === mainId) return;
    // a.merchantId is always a candidate merchant, so nameOf has it.
    const group = groups.get(a.merchantId)
      ?? { merchantId: a.merchantId, name: ctx.nameOf.get(a.merchantId)!, items: [], saving: 0, pinned: false };
    group.items.push(item);
    // Credit the saving against main's real price; if main can't serve the item,
    // pin the group instead of crediting a phantom (near-zero) saving.
    const mainReal = ctx.realPriceAt(item.productId, mainId);
    if (mainReal === undefined) group.pinned = true;
    else group.saving += (mainReal - a.price) * item.quantity;
    groups.set(a.merchantId, group);
  });
  return [...groups.values()];
}

// Pinned groups are always kept (their items can't fall back to main). Remaining
// store slots go to the highest-saving groups that clear the marginal threshold.
function selectKept(secondaries: SecondaryGroup[], maxStores: number): SecondaryGroup[] {
  const pinned = secondaries.filter(s => s.pinned);
  const slots = Math.max(0, maxStores - 1 - pinned.length);
  const optional = secondaries
    .filter(s => !s.pinned && s.saving >= MARGINAL_SAVING_THRESHOLD)
    .sort((a, b) => b.saving - a.saving)
    .slice(0, slots);
  return [...pinned, ...optional];
}

function singleStore(
  baseline: { merchantId: string; name: string; total: number },
  priceable: OptimizerItem[],
  ctx: Ctx,
  unresolved: string[],
  reason: string,
): OptimizationResult {
  return {
    optimized: false,
    baseline: { merchantId: baseline.merchantId, name: baseline.name, total: round2(baseline.total) },
    totalExpectedSaving: 0,
    stores: [buildStore(baseline.merchantId, baseline.name, true, priceable, ctx)],
    unresolvedItems: unresolved,
    reason,
  };
}

function buildStore(
  merchantId: string,
  name: string,
  isPrimary: boolean,
  items: OptimizerItem[],
  ctx: Ctx,
): StoreSubList {
  const lines = items.map(it => buildLine(it, merchantId, ctx));
  return { merchantId, name, isPrimary, subtotal: round2(sum(lines.map(l => l.lineTotal))), lines };
}

function buildLine(item: OptimizerItem, merchantId: string, ctx: Ctx): StoreLine {
  const cell = ctx.cellMap.get(key(item.productId, merchantId)) ?? null;
  const expectedPrice = round2(ctx.priceAt(item.productId, merchantId));
  return {
    productId: item.productId,
    displayName: item.displayName,
    expectedPrice,
    quantity: item.quantity,
    lineTotal: round2(expectedPrice * item.quantity),
    observationCount: cell?.observationCount ?? 0,
    lastObservedOn: cell?.lastObservedOn ?? null,
    confidence: confidenceOf(cell, ctx.today),
  };
}

function confidenceOf(cell: PriceCell | null, today: string): Confidence {
  if (!cell) return 'low';
  const ageDays = Math.round((Date.parse(today) - Date.parse(cell.lastObservedOn)) / 86_400_000);
  if (cell.observationCount >= 10 && ageDays <= 30) return 'high';
  if (cell.observationCount >= 3 && ageDays <= 90) return 'medium';
  return 'low';
}

function emptyResult(unresolved: string[]): OptimizationResult {
  return {
    optimized: false,
    baseline: null,
    totalExpectedSaving: 0,
    stores: [],
    unresolvedItems: unresolved,
    reason: 'insufficient regional price data',
  };
}
