import type { ComparisonSet, IComparisonSetRepository } from '@core/ports/comparison/IComparisonSetRepository';
import {
  ComparisonSetLimitError,
  ComparisonSetNotFoundError,
  InvalidComparisonSetError,
} from '@core/domain/errors';

// Max members per comparison set (09/04). A product may belong to multiple sets; each set caps at
// this many members. Enforced here (domain), not in the DB, per the spec.
export const COMPARISON_SET_MAX_MEMBERS = 5;

// 09/04 comparison-set CRUD. Tenant-scoped and RLS-protected at the adapter, so one user's sets
// never affect another user's comparisons or the global price store — zero catalog-poisoning
// surface. No premium gate: comparison sets are a core tenant feature.
export class ComparisonSetService {
  constructor(private readonly repo: IComparisonSetRepository) {}

  list(): Promise<ComparisonSet[]> {
    return this.repo.list();
  }

  async get(setId: string): Promise<ComparisonSet> {
    const set = await this.repo.getById(setId);
    if (!set) throw new ComparisonSetNotFoundError(setId);
    return set;
  }

  create(name: string | null): Promise<string> {
    return this.repo.create(normalizeName(name));
  }

  async rename(setId: string, name: string | null): Promise<void> {
    const ok = await this.repo.rename(setId, normalizeName(name));
    if (!ok) throw new ComparisonSetNotFoundError(setId);
  }

  async remove(setId: string): Promise<void> {
    const ok = await this.repo.remove(setId);
    if (!ok) throw new ComparisonSetNotFoundError(setId);
  }

  // Adds a product to the set as a USER member. "Same size/pack?" answered Yes → sizeEquivalent
  // true (rankable); "Not sure" → false (watch-only). Guards the 5-member cap and duplicate adds.
  async addMember(setId: string, productId: string, sizeEquivalent: boolean): Promise<string> {
    if (!productId) throw new InvalidComparisonSetError('productId is required');
    if (!(await this.repo.exists(setId))) throw new ComparisonSetNotFoundError(setId);
    if ((await this.repo.memberCount(setId)) >= COMPARISON_SET_MAX_MEMBERS) {
      throw new ComparisonSetLimitError(COMPARISON_SET_MAX_MEMBERS);
    }
    const id = await this.repo.addMember(setId, productId, sizeEquivalent);
    if (id === null) throw new InvalidComparisonSetError('product is already in this set');
    return id;
  }

  async removeMember(setId: string, memberId: string): Promise<void> {
    const ok = await this.repo.removeMember(setId, memberId);
    if (!ok) throw new ComparisonSetNotFoundError(setId);
  }

  async setSizeEquivalent(setId: string, memberId: string, sizeEquivalent: boolean): Promise<void> {
    const ok = await this.repo.setSizeEquivalent(setId, memberId, sizeEquivalent);
    if (!ok) throw new ComparisonSetNotFoundError(setId);
  }
}

function normalizeName(name: string | null): string | null {
  if (name === null) return null;
  const trimmed = name.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, 60);
}
