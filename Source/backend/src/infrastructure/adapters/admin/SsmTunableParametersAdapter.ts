import {
  SSMClient,
  GetParametersCommand,
  PutParameterCommand,
} from '@aws-sdk/client-ssm';
import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const SSM_GET_BATCH = 10; // GetParameters hard ceiling

// Read (batched) + write path for admin-editable SSM parameters. The caller passes
// only allowlisted logical paths (AdminConfigService); this adapter stage-scopes them
// to the physical Parameter Store name and maps the response back to the logical key
// the caller asked for, so callers stay unaware of the per-stage layout.
export class SsmTunableParametersAdapter implements ITunableParameterStore {
  private readonly client: SSMClient;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getValues(ssmPaths: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = Object.fromEntries(ssmPaths.map((p) => [p, null]));
    const physicalToLogical = new Map(ssmPaths.map((p) => [stageScopeConfig(p), p] as const));
    const names = [...physicalToLogical.keys()];
    for (let i = 0; i < names.length; i += SSM_GET_BATCH) {
      const batch = names.slice(i, i + SSM_GET_BATCH);
      const response = await this.client.send(new GetParametersCommand({ Names: batch }));
      for (const param of response.Parameters ?? []) {
        const logical = param.Name ? physicalToLogical.get(param.Name) : undefined;
        if (logical) result[logical] = param.Value ?? null;
      }
    }
    return result;
  }

  async setValue(ssmPath: string, value: string): Promise<void> {
    await this.client.send(
      new PutParameterCommand({
        Name: stageScopeConfig(ssmPath),
        Value: value,
        Type: 'String',
        Overwrite: true,
      }),
    );
  }
}
