import type { IPriceTrendQuery, PriceTrendLine } from '../../ports/data-intelligence/IPriceTrendQuery';
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
  ownHistory: OwnPurchaseLine[]; // the caller's own purchases — always served, no quorum gate
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
    const lines = includeMarketTrend ? await this.trends.comparison(marketInput) : [];
    // Cold-start motivator count — only meaningful for the market view when NO cell cleared the
    // gate (the webapp shows it only then). Skip the extra query whenever the chart already renders.
    const regionMerchantCount =
      includeMarketTrend && lines.length === 0 ? await this.trends.regionMerchantCount(marketInput) : 0;
    const ownHistory = await this.ownHistory.history({
      productIds: products,
      countryCode,
      regionCode,
      weeks: TREND_WINDOW_WEEKS,
      currency,
    });
    return {
      countryCode,
      regionCode,
      weeks: TREND_WINDOW_WEEKS,
      currency,
      regionMerchantCount,
      lines: lines.map((l) => this.decorate(l)),
      ownHistory,
    };
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
}

function daysSince(isoDate: string, now: Date): number {
  const observed = Date.parse(`${isoDate}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - observed) / 86_400_000);
}
