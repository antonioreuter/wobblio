import type { SeriesSize } from '@core/ports/data-intelligence/IPriceTrendQuery';

// §6.5.1 / 09/04 comparison sets: a tenant-scoped assertion that products (each at its own
// merchant under per-merchant identity, 09/02) are interchangeable for THIS user. Both tables are
// RLS-enabled, so the tenant context MUST be set before any call (invariant #1).

export type ComparisonMemberSource = 'USER' | 'SPLIT_SEED';

export interface ComparisonSetMember {
  id: string;
  productId: string;
  displayName: string;
  brand: string | null;
  merchantId: string | null;
  merchantName: string | null;
  source: ComparisonMemberSource;
  // The user confirmed this member is the same size/pack as the others (09/04). Sole override to
  // the comparability rule (09/05). SPLIT_SEED members are always false (watch-only) until confirmed.
  sizeEquivalent: boolean;
  size: SeriesSize; // descriptive pack size chip (09/01); never a price basis
  addedAt: string;
}

export interface ComparisonSet {
  id: string;
  name: string | null;
  createdAt: string;
  members: ComparisonSetMember[];
}

export interface IComparisonSetRepository {
  list(): Promise<ComparisonSet[]>;
  getById(setId: string): Promise<ComparisonSet | null>;
  create(name: string | null): Promise<string>;
  rename(setId: string, name: string | null): Promise<boolean>;
  remove(setId: string): Promise<boolean>;
  memberCount(setId: string): Promise<number>;
  // True when the set exists (for the caller's tenant) — used to 404 before member mutations.
  exists(setId: string): Promise<boolean>;
  addMember(setId: string, productId: string, sizeEquivalent: boolean): Promise<string | null>;
  removeMember(setId: string, memberId: string): Promise<boolean>;
  setSizeEquivalent(setId: string, memberId: string, sizeEquivalent: boolean): Promise<boolean>;
}
