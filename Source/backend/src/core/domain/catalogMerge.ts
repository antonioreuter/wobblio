import { ConfidenceThresholds } from './ingestion';

// Structural + semantic compatibility of a source→target product merge. A merge moves
// the source's aliases and observations onto the target, so an incompatible merge poisons
// a good product's future emissions — it must be refused, not just discouraged.
export interface MergeCompatibility {
  categoryMatch: boolean;
  unitMatch: boolean;
  // Per-merchant identity (09/02): a merge moves the source's aliases/observations onto the target,
  // so both products must belong to the same merchant. A cross-merchant merge would re-introduce the
  // silent SKU collision this family removed, and is refused.
  merchantMatch: boolean;
  similarity: number; // cosine 0..1; 0 when an embedding is missing (treated as unverified)
}

export type MergeBlockReason = 'category_mismatch' | 'unit_mismatch' | 'merchant_mismatch' | 'low_similarity';

// Null => the merge is allowed. Otherwise the first failing guard, for a skip reason or
// a refusal error. Category, unit, and merchant must match exactly; similarity must clear the floor.
export function mergeBlockReason(c: MergeCompatibility): MergeBlockReason | null {
  if (!c.categoryMatch) return 'category_mismatch';
  if (!c.unitMatch) return 'unit_mismatch';
  if (!c.merchantMatch) return 'merchant_mismatch';
  if (c.similarity < ConfidenceThresholds.mergeSimilarityMin) return 'low_similarity';
  return null;
}
