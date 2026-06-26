import type {
  ICatalogCurationRepository,
  QueueFilters,
  CurationSort,
  CategoryCount,
  CountryCount,
  RegionCount,
} from '@core/ports/data-intelligence/ICatalogCurationRepository';
import type { IAdminAuditLog, AdminActor } from '@core/ports/admin/IAdminAuditLog';
import { toCurationItem, type CurationItem } from '@core/domain/catalogCuration';
import { mergeBlockReason } from '@core/domain/catalogMerge';
import { InvalidAdminInputError, UnknownAdminTargetError, MergeNotAllowedError } from '@core/domain/errors';

export interface MergeBatchResult {
  applied: string[];
  skipped: { id: string; reason: string }[];
}

export type CatalogKind = 'merchant' | 'product';

// Raw query params from the route, pre-validation.
export interface RawQueueQuery {
  country?: string;
  region?: string;
  category?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

const SORTS: readonly CurationSort[] = ['waiting', 'name', 'date'];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export class AdminCurationService {
  constructor(
    private readonly repo: ICatalogCurationRepository,
    private readonly audit: IAdminAuditLog,
  ) {}

  async list(kind: CatalogKind, raw: RawQueueQuery): Promise<CurationItem[]> {
    const filters = this.buildFilters(kind, raw);
    const entities =
      kind === 'merchant'
        ? await this.repo.listProvisionalMerchants(filters)
        : await this.repo.listProvisionalProducts(filters);
    return entities.map(toCurationItem);
  }

  // The mandatory country selector — only countries that have provisional items.
  countries(kind: CatalogKind): Promise<CountryCount[]> {
    return kind === 'merchant' ? this.repo.merchantCountries() : this.repo.productCountries();
  }

  // Per-category counts for the pie (and category picker), scoped to a country [+region].
  async categories(kind: CatalogKind, country: string, region: string | null): Promise<CategoryCount[]> {
    requireCountry(country);
    return kind === 'merchant'
      ? this.repo.merchantCategories(country, region)
      : this.repo.productCategories(country, region);
  }

  async regions(kind: CatalogKind, country: string): Promise<RegionCount[]> {
    requireCountry(country);
    return kind === 'merchant' ? this.repo.merchantRegions(country) : this.repo.productRegions(country);
  }

  // Country is always required. Category is an optional filter (null = all
  // categories) for both kinds.
  private buildFilters(_kind: CatalogKind, raw: RawQueueQuery): QueueFilters {
    const country = (raw.country ?? '').trim();
    requireCountry(country);
    const category = raw.category?.trim() || null;
    return {
      country,
      region: raw.region?.trim() || null,
      category,
      sort: SORTS.includes(raw.sort as CurationSort) ? (raw.sort as CurationSort) : 'waiting',
      limit: clamp(raw.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT),
      offset: Math.max(0, Math.trunc(raw.offset ?? 0)),
    };
  }

  approve(actor: AdminActor, kind: CatalogKind, id: string): Promise<void> {
    return this.setStatus(actor, kind, id, 'ACTIVE', 'curation.approve');
  }

  reject(actor: AdminActor, kind: CatalogKind, id: string): Promise<void> {
    // No REJECTED status — reject maps to INACTIVE (admin-console 06 decision).
    return this.setStatus(actor, kind, id, 'INACTIVE', 'curation.reject');
  }

  async merge(actor: AdminActor, kind: CatalogKind, id: string, targetId: string): Promise<void> {
    if (!targetId) throw new InvalidAdminInputError('targetId is required');
    if (kind === 'product') return this.mergeOneProduct(actor, id, targetId);

    const merged = await this.repo.mergeMerchant(id, targetId);
    if (!merged) throw new UnknownAdminTargetError(`merchant:${id}->${targetId}`);
    await this.record(actor, 'curation.merge', 'merchant', id, { targetId });
  }

  // Merge-group commit (B3): pick the canonical target, fold compatible sources in,
  // skip incompatible ones (best-effort) with a reason so the operator can act on them.
  async mergeBatch(actor: AdminActor, targetId: string, sourceIds: string[]): Promise<MergeBatchResult> {
    if (!targetId) throw new InvalidAdminInputError('targetId is required');
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      throw new InvalidAdminInputError('sourceIds must be a non-empty array');
    }
    const applied: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const sourceId of sourceIds) {
      try {
        await this.mergeOneProduct(actor, sourceId, targetId);
        applied.push(sourceId);
      } catch (err) {
        if (err instanceof MergeNotAllowedError) skipped.push({ id: sourceId, reason: err.reason });
        else if (err instanceof UnknownAdminTargetError) skipped.push({ id: sourceId, reason: 'not_found' });
        else throw err;
      }
    }
    return { applied, skipped };
  }

  // Guarded single product merge: refuse a pair that isn't the same item (category/unit
  // mismatch or low similarity), else apply and audit the moved-id provenance.
  private async mergeOneProduct(actor: AdminActor, sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) throw new MergeNotAllowedError('same_as_target');
    const compat = await this.repo.getMergeCompatibility(sourceId, targetId);
    if (!compat) throw new UnknownAdminTargetError(`product:${sourceId}->${targetId}`);
    const reason = mergeBlockReason(compat);
    if (reason) throw new MergeNotAllowedError(reason);

    const provenance = await this.repo.mergeProduct(sourceId, targetId);
    if (!provenance) throw new UnknownAdminTargetError(`product:${sourceId}->${targetId}`);
    await this.record(actor, 'curation.merge', 'product', sourceId, { targetId, ...provenance, similarity: compat.similarity });
  }

  // Operator preview for a candidate merge group: per-source compatibility against the
  // chosen target, so the UI can flag/disable incompatible rows before commit.
  mergeCompatibility(sourceId: string, targetId: string): ReturnType<ICatalogCurationRepository['getMergeCompatibility']> {
    return this.repo.getMergeCompatibility(sourceId, targetId);
  }

  listProductAliases(productId: string): ReturnType<ICatalogCurationRepository['listProductAliases']> {
    return this.repo.listProductAliases(productId);
  }

  // Past-merge audit history (B4): the remediation entry point for already-made merges.
  listMerges(limit: number): ReturnType<IAdminAuditLog['list']> {
    return this.audit.list('curation.merge', limit);
  }

  async deactivateAlias(actor: AdminActor, productId: string, aliasId: string): Promise<void> {
    const ok = await this.repo.deactivateAlias(aliasId);
    if (!ok) throw new UnknownAdminTargetError(`alias:${aliasId}`);
    await this.record(actor, 'curation.alias_deactivate', 'product', productId, { deactivatedAlias: aliasId });
  }

  // Batch approve/reject of selected ids; returns how many were applied.
  async batch(actor: AdminActor, kind: CatalogKind, action: 'approve' | 'reject', ids: string[]): Promise<number> {
    if (!Array.isArray(ids) || ids.length === 0) throw new InvalidAdminInputError('ids must be a non-empty array');
    let applied = 0;
    for (const id of ids) {
      const apply = action === 'approve' ? this.approve(actor, kind, id) : this.reject(actor, kind, id);
      await apply.then(() => (applied += 1)).catch(() => undefined);
    }
    return applied;
  }

  private async setStatus(
    actor: AdminActor,
    kind: CatalogKind,
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    action: 'curation.approve' | 'curation.reject',
  ): Promise<void> {
    const ok =
      kind === 'merchant'
        ? await this.repo.setMerchantStatus(id, status)
        : await this.repo.setProductStatus(id, status);
    if (!ok) throw new UnknownAdminTargetError(`${kind}:${id}`);
    await this.applyObservationEffect(kind, id, status);
    await this.record(actor, action, kind, id, { status });
  }

  // Status alone doesn't move the price index — it gates on `quarantined`. Promotion
  // releases born-quarantined rows (when product+merchant are both ACTIVE); rejection
  // quarantines them. (§6.5 / §6.8)
  private applyObservationEffect(kind: CatalogKind, id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    if (status === 'ACTIVE') {
      return kind === 'merchant' ? this.repo.releaseMerchantObservations(id) : this.repo.releaseProductObservations(id);
    }
    return kind === 'merchant' ? this.repo.quarantineMerchantObservations(id) : this.repo.quarantineProductObservations(id);
  }

  private record(
    actor: AdminActor,
    action: 'curation.approve' | 'curation.reject' | 'curation.merge' | 'curation.alias_deactivate',
    kind: CatalogKind,
    id: string,
    after: unknown,
  ): Promise<void> {
    return this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action,
      target: `${kind}:${id}`,
      after,
    });
  }
}

function requireCountry(country: string): void {
  if (!country || !country.trim()) throw new InvalidAdminInputError('country is required');
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
