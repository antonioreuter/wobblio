import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { IWaitlistCapProvider } from '@core/ports/waitlist/IWaitlistCapProvider';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const CAP_PARAM = stageScopeConfig('/wobblio/config/quotas/max_free_waitlist_cap');

export class SsmWaitlistCapAdapter implements IWaitlistCapProvider {
  private readonly client: SSMClient;
  private cachedCap: number | null = null;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getMaxFreeUsersCap(): Promise<number> {
    if (this.cachedCap !== null) return this.cachedCap;
    const response = await this.client.send(new GetParameterCommand({ Name: CAP_PARAM }));
    const raw = response.Parameter?.Value;
    if (!raw) throw new Error(`SSM parameter ${CAP_PARAM} is missing or empty`);
    this.cachedCap = parseInt(raw, 10);
    return this.cachedCap;
  }
}
