import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { IAiSpendCapProvider } from '@core/ports/ai/IAiSpendCapProvider';

const CAP_PARAM = '/wobblio/config/ai/daily_spend_cap';

export class SsmSpendCapAdapter implements IAiSpendCapProvider {
  private readonly client: SSMClient;
  private cachedCap: number | null = null;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getDailyCapEur(): Promise<number> {
    if (this.cachedCap !== null) return this.cachedCap;
    const response = await this.client.send(new GetParameterCommand({ Name: CAP_PARAM }));
    const raw = response.Parameter?.Value;
    if (!raw) throw new Error(`SSM parameter ${CAP_PARAM} is missing or empty`);
    this.cachedCap = parseFloat(raw);
    return this.cachedCap;
  }
}
