// Fix 10 — ranks cross-merchant counterpart products for the trend report's suggestion chips.
// Pure: the adapter supplies similarity signals from the catalog (pgvector cosine + pg_trgm) and a
// linked flag; this decides which candidates are worth suggesting and in what order. A candidate the
// user already linked (an ACCEPTED product_link, including a SPLIT_SEED backfill) always surfaces and
// ranks first with a link glyph, regardless of similarity. Everything else must clear a similarity
// floor: the embedding cosine when both products carry an embedding, otherwise the name trigram score
// (products created before embeddings, or with none, fall back to names). Same-category and
// cross-merchant scoping is the adapter's job — this only ranks what it is given.

export const COUNTERPART_EMBEDDING_MIN = 0.75;
export const COUNTERPART_TRGM_MIN = 0.35;
export const COUNTERPART_MAX = 5;

export interface CounterpartCandidate {
  productId: string;
  embeddingSimilarity: number | null; // cosine in [0,1]; null when either product lacks an embedding
  nameSimilarity: number; // pg_trgm similarity in [0,1]
  linked: boolean; // already an ACCEPTED product_link for this tenant (user tap or SPLIT_SEED seed)
}

export interface RankedCounterpart {
  productId: string;
  linked: boolean;
}

function clears(candidate: CounterpartCandidate): boolean {
  if (candidate.linked) return true;
  if (candidate.embeddingSimilarity !== null) return candidate.embeddingSimilarity >= COUNTERPART_EMBEDDING_MIN;
  return candidate.nameSimilarity >= COUNTERPART_TRGM_MIN;
}

function score(candidate: CounterpartCandidate): number {
  return candidate.embeddingSimilarity ?? candidate.nameSimilarity;
}

export function rankCounterparts(candidates: CounterpartCandidate[]): RankedCounterpart[] {
  return candidates
    .filter(clears)
    // Linked candidates first (they're confirmed relationships), then by similarity descending.
    .sort((a, b) => Number(b.linked) - Number(a.linked) || score(b) - score(a))
    .slice(0, COUNTERPART_MAX)
    .map((c) => ({ productId: c.productId, linked: c.linked }));
}
