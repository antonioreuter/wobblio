import type {
  CounterpartCandidateRow,
  ICounterpartCandidateQuery,
} from '@core/ports/comparison/ICounterpartCandidateQuery';
import type { SeriesSize } from '@core/ports/data-intelligence/IPriceTrendQuery';
import { rankCounterparts } from '@core/domain/counterpartSuggestion';
import { catalogSize } from '@core/domain/unitSize';
import { InvalidTrendQueryError } from '@core/domain/errors';
import { isUuid } from '@core/domain/uuid';
import { TREND_WINDOW_WEEKS } from '@core/services/data-intelligence/PriceTrendService';

// One suggestion chip: a concrete (product @ merchant) the user can add to the chart in one tap.
// `linked` marks an already-accepted relationship (shown first, with a link glyph).
export interface CounterpartSuggestion {
  productId: string;
  displayName: string;
  brand: string | null;
  merchantId: string | null;
  merchantName: string | null;
  size: SeriesSize; // descriptive pack-size chip (09/01); never a price basis
  linked: boolean;
}

// Fix 10 — serves the trend report's counterpart suggestions for one anchor product. The query
// returns same-category, cross-merchant, region-tracked candidates with similarity + link signals;
// the domain ranker picks and orders them. Served to all roles: chips only prefill the picker (the
// market overlay itself stays Premium-gated in the comparison endpoint).
export class CounterpartSuggestionService {
  constructor(private readonly candidateQuery: ICounterpartCandidateQuery) {}

  async suggest(productId: string, countryCode: string, regionCode: string): Promise<CounterpartSuggestion[]> {
    if (!isUuid(productId)) throw new InvalidTrendQueryError('a valid productId is required');
    if (!countryCode.trim() || !regionCode.trim()) {
      throw new InvalidTrendQueryError('country and region are required');
    }

    const rows = await this.candidateQuery.candidates({
      productId,
      countryCode,
      regionCode,
      weeks: TREND_WINDOW_WEEKS,
    });
    const byId = new Map(rows.map((r) => [r.productId, r]));
    return rankCounterparts(rows).map((ranked) => toSuggestion(byId.get(ranked.productId)!, ranked.linked));
  }
}

function toSuggestion(row: CounterpartCandidateRow, linked: boolean): CounterpartSuggestion {
  return {
    productId: row.productId,
    displayName: row.displayName,
    brand: row.brand,
    merchantId: row.merchantId,
    merchantName: row.merchantName,
    size: catalogSize(row.packSizeBaseUnits, row.baseUnit),
    linked,
  };
}
