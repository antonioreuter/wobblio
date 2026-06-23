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
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

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
    const merged =
      kind === 'merchant'
        ? await this.repo.mergeMerchant(id, targetId)
        : await this.repo.mergeProduct(id, targetId);
    if (!merged) throw new UnknownAdminTargetError(`${kind}:${id}->${targetId}`);
    await this.record(actor, 'curation.merge', kind, id, { targetId });
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
    await this.record(actor, action, kind, id, { status });
  }

  private record(
    actor: AdminActor,
    action: 'curation.approve' | 'curation.reject' | 'curation.merge',
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
