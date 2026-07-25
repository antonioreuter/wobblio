import {
  SSMClient,
  GetParameterCommand,
  GetParametersCommand,
  PutParameterCommand,
} from '@aws-sdk/client-ssm';
import {
  type IModelRegistry,
  type ModelRole,
  MODEL_ROLES,
} from '@core/ports/ai/IModelRegistry';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const paramFor = (role: ModelRole): string => stageScopeConfig(`/wobblio/config/models/${role}`);

// Model ids change rarely but must not require a cold start to take effect: the admin model-swap
// matrix writes SSM and expects the fleet to follow. So reads are cached with a short TTL rather
// than forever — a swap lands within CACHE_TTL_MS on every warm container. Writes update the
// local cache so a read-after-write in the same invocation is consistent.
const CACHE_TTL_MS = 5 * 60_000;

interface CachedModelId {
  value: string;
  expiresAt: number;
}

export class SsmModelRegistryAdapter implements IModelRegistry {
  private readonly client: SSMClient;
  private readonly cache = new Map<ModelRole, CachedModelId>();

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  private fresh(role: ModelRole): string | null {
    const cached = this.cache.get(role);
    return cached && cached.expiresAt > Date.now() ? cached.value : null;
  }

  private remember(role: ModelRole, value: string): void {
    this.cache.set(role, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  async getModelId(role: ModelRole): Promise<string> {
    const cached = this.fresh(role);
    if (cached) return cached;
    const response = await this.client.send(new GetParameterCommand({ Name: paramFor(role) }));
    const value = response.Parameter?.Value;
    if (!value) throw new Error(`SSM parameter ${paramFor(role)} is missing`);
    this.remember(role, value);
    return value;
  }

  // Fail-open: a missing/empty param yields null instead of throwing, so an optional role
  // (vision_fallback) stays feature-off on stages that never provisioned it.
  async getModelIdOptional(role: ModelRole): Promise<string | null> {
    const cached = this.fresh(role);
    if (cached) return cached;
    try {
      const response = await this.client.send(new GetParameterCommand({ Name: paramFor(role) }));
      const value = response.Parameter?.Value;
      if (!value) return null;
      this.remember(role, value);
      return value;
    } catch (err) {
      if (err instanceof Error && err.name === 'ParameterNotFound') return null;
      throw err;
    }
  }

  async getAll(): Promise<Record<ModelRole, string | null>> {
    const byPath = new Map(MODEL_ROLES.map((role) => [paramFor(role), role] as const));
    const response = await this.client.send(
      new GetParametersCommand({ Names: [...byPath.keys()] }),
    );
    const result = Object.fromEntries(MODEL_ROLES.map((r) => [r, null])) as Record<ModelRole, string | null>;
    for (const param of response.Parameters ?? []) {
      const role = param.Name ? byPath.get(param.Name) : undefined;
      if (role && param.Value) result[role] = param.Value;
    }
    return result;
  }

  async setModelId(role: ModelRole, id: string): Promise<void> {
    await this.client.send(
      new PutParameterCommand({ Name: paramFor(role), Value: id, Type: 'String', Overwrite: true }),
    );
    this.remember(role, id);
  }
}
