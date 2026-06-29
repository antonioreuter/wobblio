import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { IBillingWhitelist } from '@core/ports/billing/IBillingWhitelist';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const WHITELIST_PARAM = stageScopeConfig('/wobblio/config/billing/mock_premium_whitelist');
const CACHE_TTL_MS = 60_000;

export class SsmBillingWhitelistAdapter implements IBillingWhitelist {
  private readonly client: SSMClient;
  private cachedEmails: Set<string> | null = null;
  private cachedAt = 0;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    const emails = await this.loadEmails();
    return emails.has(email.trim().toLowerCase());
  }

  private async loadEmails(): Promise<Set<string>> {
    const now = Date.now();
    if (this.cachedEmails && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedEmails;
    }

    const response = await this.client.send(new GetParameterCommand({ Name: WHITELIST_PARAM }));
    const raw = response.Parameter?.Value ?? '';
    const emails = new Set(
      raw
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0),
    );

    this.cachedEmails = emails;
    this.cachedAt = now;
    return emails;
  }
}
