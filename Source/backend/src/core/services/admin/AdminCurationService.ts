import type { ICatalogCurationRepository } from '@core/ports/data-intelligence/ICatalogCurationRepository';
import type { IAdminAuditLog, AdminActor } from '@core/ports/admin/IAdminAuditLog';
import { toCurationItem, type CurationItem } from '@core/domain/catalogCuration';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

export type CatalogKind = 'merchant' | 'product';

export class AdminCurationService {
  constructor(
    private readonly repo: ICatalogCurationRepository,
    private readonly audit: IAdminAuditLog,
  ) {}

  async list(kind: CatalogKind): Promise<CurationItem[]> {
    const entities =
      kind === 'merchant'
        ? await this.repo.listProvisionalMerchants()
        : await this.repo.listProvisionalProducts();
    return entities.map(toCurationItem);
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
