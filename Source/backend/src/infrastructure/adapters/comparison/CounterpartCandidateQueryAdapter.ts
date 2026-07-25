import type { PoolClient } from 'pg';
import type {
  CounterpartCandidateInput,
  CounterpartCandidateRow,
  ICounterpartCandidateQuery,
} from '@core/ports/comparison/ICounterpartCandidateQuery';
import type { BaseUnit } from '@core/domain/unitSize';

interface CandidateRow {
  id: string;
  display_name: string;
  brand: string | null;
  merchant_id: string | null;
  merchant_name: string | null;
  pack_size_base_units: string | null;
  base_unit: BaseUnit | null;
  embedding_similarity: number | null;
  name_similarity: number;
  linked: boolean;
}

// Bound on rows returned before the domain ranker trims to COUNTERPART_MAX. Ordered by similarity in
// SQL so the cap keeps the strongest candidates; the ranker re-sorts (linked first).
const CANDIDATE_LIMIT = 50;

// Fix 10 — counterpart candidates for the trend suggestion chips. product/merchant/price_observation
// are global (RLS-exempt); product_link is the caller's RLS-scoped table, so tenant context MUST be
// set (withTenantTx) — the LEFT JOIN then sees only this user's links. Candidates are same-category,
// cross-merchant products (per-merchant identity, 09/02) that are actually tracked in the picker's
// region within the window. DISMISSED links are filtered out in SQL so they never resurface.
export class CounterpartCandidateQueryAdapter implements ICounterpartCandidateQuery {
  constructor(private readonly client: PoolClient) {}

  async candidates(input: CounterpartCandidateInput): Promise<CounterpartCandidateRow[]> {
    const result = await this.client.query<CandidateRow>(
      `WITH region_tracked AS (
         -- The set of products with a non-quarantined observation in the region/window, computed
         -- ONCE. Joining this replaces a per-candidate correlated EXISTS and, crucially, restricts
         -- the expensive per-row cosine/trigram math to region-tracked products instead of every
         -- product in the (potentially large) same-category set.
         SELECT DISTINCT po.product_id
         FROM price_observation po
         WHERE po.quarantined = false
           AND po.country_code = $2
           AND po.region_code = $3
           AND po.observed_on >= CURRENT_DATE - ($4::int * 7)
       )
       SELECT p.id, p.display_name, p.brand,
              p.merchant_id, mer.brand_name AS merchant_name,
              p.pack_size_base_units::text AS pack_size_base_units, p.base_unit,
              CASE WHEN a.embedding IS NOT NULL AND p.embedding IS NOT NULL
                   THEN (1 - (p.embedding <=> a.embedding))::float8 END AS embedding_similarity,
              similarity(p.display_name, a.display_name)::float8 AS name_similarity,
              (pl.status = 'ACCEPTED') AS linked
       FROM product a
       JOIN product p
         ON p.category_id = a.category_id
        AND p.country_code = a.country_code
        AND p.merchant_id IS NOT NULL
        AND p.merchant_id <> a.merchant_id
        AND p.id <> a.id
        AND p.status = 'ACTIVE'
       JOIN region_tracked rt ON rt.product_id = p.id
       LEFT JOIN merchant mer ON mer.id = p.merchant_id
       -- Caller's own links only (RLS): canonical pair is (least, greatest) of the two ids.
       LEFT JOIN product_link pl
         ON pl.product_a_id = LEAST(a.id, p.id)
        AND pl.product_b_id = GREATEST(a.id, p.id)
       WHERE a.id = $1
         AND (pl.status IS NULL OR pl.status <> 'DISMISSED')
       -- Linked pairs first so an accepted link with weak similarity survives the LIMIT and the
       -- domain ranker (which floats linked candidates to the top) can still see it.
       ORDER BY (pl.status = 'ACCEPTED') DESC, embedding_similarity DESC NULLS LAST, name_similarity DESC
       LIMIT ${CANDIDATE_LIMIT}`,
      [input.productId, input.countryCode, input.regionCode, input.weeks],
    );

    return result.rows.map((row) => ({
      productId: row.id,
      displayName: row.display_name,
      brand: row.brand,
      merchantId: row.merchant_id,
      merchantName: row.merchant_name,
      packSizeBaseUnits: row.pack_size_base_units === null ? null : parseFloat(row.pack_size_base_units),
      baseUnit: row.base_unit,
      embeddingSimilarity: row.embedding_similarity,
      nameSimilarity: row.name_similarity,
      linked: row.linked ?? false,
    }));
  }
}
