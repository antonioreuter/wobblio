import type { Pool, PoolClient } from 'pg';
import type { IPriceObservationStore } from '@core/ports/data-intelligence/IPriceObservationStore';
import type { PriceObservationInput } from '@core/domain/priceObservation';

// §6.5 Price Observation Store. Global, RLS-exempt: NO SET LOCAL, NO tenant/user/
// household/invoice columns, NO tags. De-identification is the trade for cross-tenant
// aggregation.
export class PriceObservationStoreAdapter implements IPriceObservationStore {
  constructor(private readonly db: Pool | PoolClient) {}

  async emit(rows: PriceObservationInput[]): Promise<void> {
    for (const row of rows) {
      await this.db.query(
        `INSERT INTO price_observation
           (product_id, merchant_id, country_code, region_code, observed_on, pack_price,
            normalized_unit_price, base_unit, currency, was_discounted, quality,
            quarantined, contributor_trust_at_write)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          row.productId, row.merchantId, row.countryCode, row.regionCode, row.observedOn,
          row.packPrice, row.normalizedUnitPrice, row.baseUnit, row.currency,
          row.wasDiscounted, row.quality, row.quarantined, row.contributorTrustAtWrite,
        ],
      );
    }
  }
}
