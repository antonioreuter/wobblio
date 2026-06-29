import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { ISystemFaultLimitsProvider } from '@core/ports/quota/ISystemFaultLimitsProvider';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const THRESHOLD_PARAM = stageScopeConfig('/wobblio/config/quotas/max_system_faults_per_week');

// One small SSM read for the admin faults alert (§07.4). Kept separate from the hot-path
// SsmUploadQuotaAdapter so an admin-only param doesn't enter its fail-closed batch. Mirrors
// SsmWaitlistCapAdapter.
export class SsmSystemFaultLimitsAdapter implements ISystemFaultLimitsProvider {
  private readonly client: SSMClient;
  private cached: number | null = null;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getMaxSystemFaultsPerWeek(): Promise<number> {
    if (this.cached !== null) return this.cached;
    const response = await this.client.send(new GetParameterCommand({ Name: THRESHOLD_PARAM }));
    const raw = response.Parameter?.Value;
    if (!raw) throw new Error(`SSM parameter ${THRESHOLD_PARAM} is missing or empty`);
    this.cached = parseInt(raw, 10);
    return this.cached;
  }
}
