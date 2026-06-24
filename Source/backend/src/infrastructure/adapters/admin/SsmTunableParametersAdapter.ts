import {
  SSMClient,
  GetParametersCommand,
  PutParameterCommand,
} from '@aws-sdk/client-ssm';
import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';

const SSM_GET_BATCH = 10; // GetParameters hard ceiling

// Read (batched) + write path for admin-editable SSM parameters. The caller passes
// only allowlisted paths (AdminConfigService); this adapter does no policy.
export class SsmTunableParametersAdapter implements ITunableParameterStore {
  private readonly client: SSMClient;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getValues(ssmPaths: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = Object.fromEntries(ssmPaths.map((p) => [p, null]));
    for (let i = 0; i < ssmPaths.length; i += SSM_GET_BATCH) {
      const batch = ssmPaths.slice(i, i + SSM_GET_BATCH);
      const response = await this.client.send(new GetParametersCommand({ Names: batch }));
      for (const param of response.Parameters ?? []) {
        if (param.Name) result[param.Name] = param.Value ?? null;
      }
    }
    return result;
  }

  async setValue(ssmPath: string, value: string): Promise<void> {
    await this.client.send(
      new PutParameterCommand({ Name: ssmPath, Value: value, Type: 'String', Overwrite: true }),
    );
  }
}
