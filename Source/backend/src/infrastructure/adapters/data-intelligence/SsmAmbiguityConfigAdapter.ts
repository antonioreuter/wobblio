import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import type { IAmbiguityConfig } from '@core/ports/data-intelligence/IAmbiguityConfig';
import type { AmbiguityConfig } from '@core/domain/priceAmbiguity';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const GAP_PCT_PARAM = stageScopeConfig('/wobblio/config/pricing/ambiguity_gap_pct');

// 09/05 default: 40% cluster-median gap (SSM value is a percent, e.g. "40"). Cached per warm
// container like the routing config. Fails open to the default when the parameter is absent, so a
// missing SSM value never breaks pricing — it just uses the documented default.
const DEFAULT_GAP_PCT = 40;

export class SsmAmbiguityConfigAdapter implements IAmbiguityConfig {
  private readonly client: SSMClient;
  private cache: AmbiguityConfig | null = null;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async get(): Promise<AmbiguityConfig> {
    if (this.cache) return this.cache;
    const response = await this.client.send(new GetParametersCommand({ Names: [GAP_PCT_PARAM] }));
    const raw = response.Parameters?.find((p) => p.Name === GAP_PCT_PARAM)?.Value;
    const percent = raw !== undefined ? parseFloat(raw) : DEFAULT_GAP_PCT;
    this.cache = { gapPct: (Number.isFinite(percent) ? percent : DEFAULT_GAP_PCT) / 100 };
    return this.cache;
  }
}
