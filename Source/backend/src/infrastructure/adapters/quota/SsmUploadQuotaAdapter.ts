import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import type { IUploadQuotaProvider } from '@core/ports/quota/IUploadQuotaProvider';
import type { UserRole } from '@core/ports/identity/IAppUserRepository';

// Per-role weekly caps live in SSM. A stored value of -1 means "unlimited" and is
// surfaced as Infinity (QuotaService never blocks an infinite cap) — this is how
// TESTER/ADMIN stay effectively uncapped while remaining operator-editable.
const HOUSEHOLD_PARAM = '/wobblio/config/quotas/household_uploads_per_week';

function uploadsParam(role: UserRole): string {
  return `/wobblio/config/quotas/${role.toLowerCase()}_uploads_per_week`;
}

function refundsParam(role: UserRole): string {
  return `/wobblio/config/quotas/${role.toLowerCase()}_failure_refunds_per_week`;
}

const ROLES: readonly UserRole[] = ['STANDARD', 'PREMIUM', 'TESTER', 'ADMIN'];

const ALL_PARAMS: string[] = [
  HOUSEHOLD_PARAM,
  ...ROLES.map(uploadsParam),
  ...ROLES.map(refundsParam),
];

function toCap(value: number): number {
  return value < 0 ? Number.POSITIVE_INFINITY : value;
}

export class SsmUploadQuotaAdapter implements IUploadQuotaProvider {
  private readonly client: SSMClient;
  private cache: Record<string, number> | null = null;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getPersonalUploadsCap(role: UserRole): Promise<number> {
    const caps = await this.load();
    return toCap(caps[uploadsParam(role)]);
  }

  async getHouseholdUploadsCap(): Promise<number> {
    const caps = await this.load();
    return toCap(caps[HOUSEHOLD_PARAM]);
  }

  async getFailureRefundCap(role: UserRole): Promise<number> {
    const caps = await this.load();
    return toCap(caps[refundsParam(role)]);
  }

  private async load(): Promise<Record<string, number>> {
    if (this.cache) return this.cache;
    const response = await this.client.send(new GetParametersCommand({ Names: ALL_PARAMS }));
    const caps: Record<string, number> = {};
    for (const param of response.Parameters ?? []) {
      if (param.Name && param.Value) caps[param.Name] = parseInt(param.Value, 10);
    }
    for (const name of ALL_PARAMS) {
      if (caps[name] === undefined) throw new Error(`SSM parameter ${name} is missing`);
    }
    this.cache = caps;
    return caps;
  }
}
