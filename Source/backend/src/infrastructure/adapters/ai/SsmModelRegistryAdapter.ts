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

const paramFor = (role: ModelRole): string => `/wobblio/config/models/${role}`;

// Reads cache per warm container (model IDs change rarely; a swap is picked up on
// the next cold start, matching the existing worker behaviour). Writes update the
// local cache so a read-after-write in the same invocation is consistent.
export class SsmModelRegistryAdapter implements IModelRegistry {
  private readonly client: SSMClient;
  private readonly cache = new Map<ModelRole, string>();

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getModelId(role: ModelRole): Promise<string> {
    const cached = this.cache.get(role);
    if (cached) return cached;
    const response = await this.client.send(new GetParameterCommand({ Name: paramFor(role) }));
    const value = response.Parameter?.Value;
    if (!value) throw new Error(`SSM parameter ${paramFor(role)} is missing`);
    this.cache.set(role, value);
    return value;
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
    this.cache.set(role, id);
  }
}
