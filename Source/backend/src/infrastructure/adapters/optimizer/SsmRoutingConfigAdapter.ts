import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import type { IRoutingConfig } from '@core/ports/optimizer/IRoutingConfig';
import type { OptimizerConfig } from '@core/domain/routeOptimizer';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const MAX_STORES_PARAM = stageScopeConfig('/wobblio/config/routing/max_stores');
const MIN_SPLIT_PARAM = stageScopeConfig('/wobblio/config/routing/min_split_saving_eur');

export class SsmRoutingConfigAdapter implements IRoutingConfig {
  private readonly client: SSMClient;
  private cache: OptimizerConfig | null = null;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async get(): Promise<OptimizerConfig> {
    if (this.cache) return this.cache;
    const response = await this.client.send(
      new GetParametersCommand({ Names: [MAX_STORES_PARAM, MIN_SPLIT_PARAM] }),
    );
    const values: Record<string, string> = {};
    for (const param of response.Parameters ?? []) {
      if (param.Name && param.Value) values[param.Name] = param.Value;
    }
    if (values[MAX_STORES_PARAM] === undefined || values[MIN_SPLIT_PARAM] === undefined) {
      throw new Error('SSM routing parameters are missing');
    }
    this.cache = {
      maxStores: parseInt(values[MAX_STORES_PARAM], 10),
      minSplitSaving: parseFloat(values[MIN_SPLIT_PARAM]),
    };
    return this.cache;
  }
}
