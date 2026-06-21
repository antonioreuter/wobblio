import type { IPriceTrendQuery, PriceTrendLine } from '../../ports/data-intelligence/IPriceTrendQuery';
import type { IOwnPurchaseHistoryQuery, OwnPurchaseLine } from '../../ports/data-intelligence/IOwnPurchaseHistoryQuery';
import { InvalidTrendQueryError } from '../../domain/errors';

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

    const lines = includeMarketTrend
      ? await this.trends.comparison({
          productIds: products,
          countryCode,
          regionCode,
          weeks: TREND_WINDOW_WEEKS,
          kMin: TREND_K_MIN,
        })
      : [];
    const ownHistory = await this.ownHistory.history({
      productIds: products,
      countryCode,
      regionCode,
      weeks: TREND_WINDOW_WEEKS,
    });
    return {
      countryCode,
      regionCode,
      weeks: TREND_WINDOW_WEEKS,
      lines: lines.map((l) => this.decorate(l)),
      ownHistory,
    };
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
