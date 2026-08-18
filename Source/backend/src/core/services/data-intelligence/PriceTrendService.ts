import type { IPriceTrendQuery, PriceTrendLine, PriceTrendQueryInput, ProductObservationStats } from '../../ports/data-intelligence/IPriceTrendQuery';
import type { IOwnPurchaseHistoryQuery, OwnPurchaseLine } from '../../ports/data-intelligence/IOwnPurchaseHistoryQuery';
import { InvalidTrendQueryError } from '../../domain/errors';
import { countryCurrency } from '../../domain/currencyByCountry';

// §6.5.1 / §6.5.2 serving constants. k and staleness mirror the §6.8 Gate-2 tunables.
export const TREND_WINDOW_WEEKS = 26;
export const TREND_K_MIN = 3;
export const TREND_STALE_DAYS = 60;
export const TREND_MAX_PRODUCTS = 3;

export interface ServedPriceTrendLine extends PriceTrendLine {
  stale: boolean; // no observation in the last TREND_STALE_DAYS
  staleDays: number; // age of the most recent observation, in days
}

// §6.5.2 freshness honesty applies to the caller's own series too — a product last bought five
// months ago must grey with its age, exactly like a stale market cell.
export interface ServedOwnPurchaseLine extends OwnPurchaseLine {
  stale: boolean;
  staleDays: number;
}

// Fix 10 — why a selected product produced no MARKET line, so the webapp shows a specific note on
// the product chip instead of a silently empty chart.
//   SERVED                    — a line rendered; nothing to explain
//   PREMIUM_REQUIRED          — market overlay is Premium-only; the caller isn't
//   NO_OBSERVATIONS_IN_REGION — no one has scanned this product in the region yet
//   OUT_OF_WINDOW             — region rows exist, but all older than the 26-week window
//   CURRENCY_MISMATCH         — in-window rows exist, but in a currency other than the view currency
//   BELOW_QUORUM              — in-window rows exist but no merchant cleared k≥3 (carries how close)
export type MarketDiagnostic =
  | 'SERVED'
  | 'PREMIUM_REQUIRED'
  | 'NO_OBSERVATIONS_IN_REGION'
  | 'OUT_OF_WINDOW'
  | 'CURRENCY_MISMATCH'
  | { kind: 'BELOW_QUORUM'; merchantCount: number; maxObservations: number };

// Why a selected product produced no OWN-history line. Derived from ownHistory (no extra query).
export type OwnDiagnostic = 'SERVED' | 'NO_PURCHASES_IN_REGION';

export interface ProductDiagnostic {
  productId: string;
  market: MarketDiagnostic;
  own: OwnDiagnostic;
}

export interface PriceTrendComparison {
  countryCode: string;
  regionCode: string;
  weeks: number;
  // The single ISO-4217 currency the whole view is filtered to and rendered in (§6.5 currency
  // honesty). Country-derived, or the region's modal currency when the country isn't mapped;
  // null only when no observations exist to infer one.
  currency: string | null;
  // Pre-gate count of merchants tracking a selected product in the region — drives the cold-start
  // "N stores tracked in your area" motivator. 0 for non-Premium (no market view) or nothing yet.
  regionMerchantCount: number;
  lines: ServedPriceTrendLine[]; // public market trend — Premium only; [] otherwise
  ownHistory: ServedOwnPurchaseLine[]; // the caller's own purchases — always served, no quorum gate
  // Per requested product: why it did (or didn't) plot in each mode (fix 10). Lets the webapp show a
  // specific note per product and auto-fall-back between modes instead of a blank chart.
  diagnostics: ProductDiagnostic[];
}

// Serves the comparison chart for the caller's region. Two series: the de-identified public
// market trend (k≥3 gate in the SQL adapter, Premium-only via includeMarketTrend) and the
// caller's own purchase history (RLS-scoped, no quorum gate). This service guards the request
// shape and decorates each public line with staleness; role policy stays in the handler.
export class PriceTrendService {
  constructor(
    private readonly trends: IPriceTrendQuery,
    private readonly ownHistory: IOwnPurchaseHistoryQuery,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async comparison(
    productIds: string[],
    countryCode: string,
    regionCode: string,
    includeMarketTrend: boolean,
  ): Promise<PriceTrendComparison> {
    const products = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
    if (products.length === 0) throw new InvalidTrendQueryError('select at least one product');
    if (products.length > TREND_MAX_PRODUCTS) {
      throw new InvalidTrendQueryError(`at most ${TREND_MAX_PRODUCTS} products`);
    }
    if (!countryCode.trim() || !regionCode.trim()) {
      throw new InvalidTrendQueryError('country and region are required');
    }

    // Resolve one view currency up front so both series are filtered to it and never blend.
    const currency = await this.resolveCurrency(products, countryCode, regionCode);

    const marketInput = {
      productIds: products,
      countryCode,
      regionCode,
      weeks: TREND_WINDOW_WEEKS,
      kMin: TREND_K_MIN,
      currency,
    };
    // The market trend and the caller's own history are independent, so fetch them in parallel —
    // one DB round-trip of latency instead of two on every request.
    const [lines, ownHistory] = await Promise.all([
      includeMarketTrend ? this.trends.comparison(marketInput) : Promise.resolve<PriceTrendLine[]>([]),
      this.ownHistory.history({ productIds: products, countryCode, regionCode, weeks: TREND_WINDOW_WEEKS, currency }),
    ]);
    // Cold-start motivator count — only meaningful for the market view when NO cell cleared the
    // gate (the webapp shows it only then). Skip the extra query whenever the chart already renders.
    const regionMerchantCount =
      includeMarketTrend && lines.length === 0 ? await this.trends.regionMerchantCount(marketInput) : 0;
    const diagnostics = await this.diagnose(products, marketInput, lines, ownHistory, includeMarketTrend);
    return {
      countryCode,
      regionCode,
      weeks: TREND_WINDOW_WEEKS,
      currency,
      regionMerchantCount,
      lines: lines.map((l) => this.decorate(l)),
      ownHistory: ownHistory.map((o) => this.decorateOwn(o)),
      diagnostics,
    };
  }

  // Per requested product, explain each mode's outcome. The market stats query runs only when the
  // market view is on AND some product has no served line (mirrors the regionMerchantCount guard) —
  // when everything plots there is nothing to diagnose and no query is issued.
  private async diagnose(
    products: string[],
    marketInput: PriceTrendQueryInput,
    lines: PriceTrendLine[],
    ownHistory: OwnPurchaseLine[],
    includeMarketTrend: boolean,
  ): Promise<ProductDiagnostic[]> {
    const servedMarket = new Set(lines.map((l) => l.productId));
    const servedOwn = new Set(ownHistory.map((o) => o.productId));
    const needStats = includeMarketTrend && products.some((id) => !servedMarket.has(id));
    const stats = needStats
      ? new Map((await this.trends.productDiagnostics(marketInput)).map((s) => [s.productId, s]))
      : new Map<string, ProductObservationStats>();

    return products.map((productId) => ({
      productId,
      market: this.marketDiagnostic(productId, includeMarketTrend, servedMarket, stats),
      own: servedOwn.has(productId) ? 'SERVED' : 'NO_PURCHASES_IN_REGION',
    }));
  }

  private marketDiagnostic(
    productId: string,
    includeMarketTrend: boolean,
    servedMarket: Set<string>,
    stats: Map<string, ProductObservationStats>,
  ): MarketDiagnostic {
    if (!includeMarketTrend) return 'PREMIUM_REQUIRED';
    if (servedMarket.has(productId)) return 'SERVED';
    const stat = stats.get(productId);
    if (!stat) return 'NO_OBSERVATIONS_IN_REGION';
    if (stat.inWindowCurrencyCount === 0) {
      return stat.otherCurrencyInWindowCount > 0 ? 'CURRENCY_MISMATCH' : 'OUT_OF_WINDOW';
    }
    return { kind: 'BELOW_QUORUM', merchantCount: stat.merchantCount, maxObservations: stat.maxCellCount };
  }

  // View currency for a single-currency view. Country-derived when the country is mapped. For an
  // unmapped country, prefer the modal currency of the CALLER'S OWN receipts over the public
  // store's — the currency filter must never hide the user's own purchases (own history is the
  // day-1 hook, never gated); the public modal is only a last resort when they have none here.
  // null only when nothing can be inferred (no data to render anyway).
  private async resolveCurrency(
    productIds: string[],
    countryCode: string,
    regionCode: string,
  ): Promise<string | null> {
    const expected = countryCurrency(countryCode);
    if (expected) return expected;
    const region = { productIds, countryCode, regionCode, weeks: TREND_WINDOW_WEEKS };
    return (await this.ownHistory.modalCurrency(region)) ?? (await this.trends.modalCurrency(region));
  }

  private decorate(line: PriceTrendLine): ServedPriceTrendLine {
    const staleDays = daysSince(line.lastObservedOn, this.now());
    return { ...line, staleDays, stale: staleDays > TREND_STALE_DAYS };
  }

  private decorateOwn(line: OwnPurchaseLine): ServedOwnPurchaseLine {
    const staleDays = daysSince(line.lastPurchasedOn, this.now());
    return { ...line, staleDays, stale: staleDays > TREND_STALE_DAYS };
  }
}

function daysSince(isoDate: string, now: Date): number {
  const observed = Date.parse(`${isoDate}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - observed) / 86_400_000);
}
