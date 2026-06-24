import type { ProvisionalEntity } from '@core/ports/data-intelligence/ICatalogCurationRepository';

// §6.8 / invariant #8: a serving cell needs k≥3 distinct observations at read time.
// The curation queue surfaces this as the corroboration status per entity.
export const QUORUM_K = 3;

export interface CurationItem extends ProvisionalEntity {
  quorum: number;
  corroborationMet: boolean;
}

export function toCurationItem(entity: ProvisionalEntity): CurationItem {
  return { ...entity, quorum: QUORUM_K, corroborationMet: entity.observationCount >= QUORUM_K };
}
