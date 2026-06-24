import {
  type IModelRegistry,
  type ModelRole,
  MODEL_ROLES,
  isModelRole,
} from '@core/ports/ai/IModelRegistry';
import type { IAdminAuditLog, AdminActor, AdminAuditRow } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import { MODEL_OPTIONS, type ModelOption } from '@core/domain/modelCatalog';

export interface ModelEntry {
  role: ModelRole;
  modelId: string | null;
  options: ModelOption[];
}

const SWAP_HISTORY_LIMIT = 50;

export class AdminModelService {
  constructor(
    private readonly registry: IModelRegistry,
    private readonly audit: IAdminAuditLog,
  ) {}

  async list(): Promise<ModelEntry[]> {
    const all = await this.registry.getAll();
    return MODEL_ROLES.map((role) => ({ role, modelId: all[role], options: MODEL_OPTIONS[role] }));
  }

  // Swaps one role's model ID. Validates the role against the 4-role allowlist and
  // requires a non-empty ID; audits model.swap with the old → new id.
  async swap(actor: AdminActor, role: string, newId: unknown): Promise<string> {
    if (!isModelRole(role)) throw new UnknownAdminTargetError(role);
    const id = typeof newId === 'string' ? newId.trim() : '';
    if (!id) throw new InvalidAdminInputError('modelId must be a non-empty string');

    const before = (await this.registry.getAll())[role];
    await this.registry.setModelId(role, id);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'model.swap',
      target: role,
      before,
      after: id,
    });
    return id;
  }

  history(): Promise<AdminAuditRow[]> {
    return this.audit.list('model.swap', SWAP_HISTORY_LIMIT);
  }
}
