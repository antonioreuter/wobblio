import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import type { IUploadQuotaProvider } from '@core/ports/quota/IUploadQuotaProvider';
import type { UserRole } from '@core/ports/identity/IAppUserRepository';

const STANDARD_PARAM = '/wobblio/config/quotas/standard_uploads_per_week';
const PREMIUM_PARAM = '/wobblio/config/quotas/premium_uploads_per_week';
const HOUSEHOLD_PARAM = '/wobblio/config/quotas/household_uploads_per_week';
const STANDARD_REFUNDS_PARAM = '/wobblio/config/quotas/standard_failure_refunds_per_week';
const PREMIUM_REFUNDS_PARAM = '/wobblio/config/quotas/premium_failure_refunds_per_week';

export class SsmUploadQuotaAdapter implements IUploadQuotaProvider {
  private readonly client: SSMClient;
  private cache: Record<string, number> | null = null;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getPersonalUploadsCap(role: UserRole): Promise<number> {
    // TESTER/ADMIN are operator-flipped internal roles (invariant #5) and upload
    // without a weekly limit; QuotaService never blocks against an infinite cap.
    if (role === 'TESTER' || role === 'ADMIN') return Number.POSITIVE_INFINITY;
    const caps = await this.load();
    return role === 'STANDARD' ? caps[STANDARD_PARAM] : caps[PREMIUM_PARAM];
  }

  async getHouseholdUploadsCap(): Promise<number> {
    const caps = await this.load();
    return caps[HOUSEHOLD_PARAM];
  }

  async getFailureRefundCap(role: UserRole): Promise<number> {
    if (role === 'TESTER' || role === 'ADMIN') return Number.POSITIVE_INFINITY;
    const caps = await this.load();
    return role === 'STANDARD' ? caps[STANDARD_REFUNDS_PARAM] : caps[PREMIUM_REFUNDS_PARAM];
  }

  private async load(): Promise<Record<string, number>> {
    if (this.cache) return this.cache;
    const names = [STANDARD_PARAM, PREMIUM_PARAM, HOUSEHOLD_PARAM, STANDARD_REFUNDS_PARAM, PREMIUM_REFUNDS_PARAM];
    const response = await this.client.send(new GetParametersCommand({ Names: names }));
    const caps: Record<string, number> = {};
    for (const param of response.Parameters ?? []) {
      if (param.Name && param.Value) caps[param.Name] = parseInt(param.Value, 10);
    }
    for (const name of names) {
      if (caps[name] === undefined) throw new Error(`SSM parameter ${name} is missing`);
    }
    this.cache = caps;
    return caps;
  }
}
