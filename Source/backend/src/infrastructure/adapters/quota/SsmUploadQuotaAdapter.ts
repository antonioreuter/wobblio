import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import type { IUploadQuotaProvider } from '@core/ports/quota/IUploadQuotaProvider';
import type { IUploadLimitsProvider } from '@core/ports/quota/IUploadLimitsProvider';
import type { UserRole } from '@core/ports/identity/IAppUserRepository';
import { BEDROCK_MAX_PDF_BYTES } from '@core/domain/pdf';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

// Cache TTL: caps change only on rare admin edits, so a warm container reuses the SSM
// batch this long instead of re-fetching per request, while bounding how stale an
// operator edit can be before it takes effect.
const CACHE_TTL_MS = 5 * 60 * 1000;

// Per-role weekly caps live in SSM as invoice limits; the cap returned here is in
// credits (invoice limit × average tokens per invoice). A stored limit of -1 means
// "unlimited" and is surfaced as Infinity (QuotaService never blocks an infinite cap),
// so TESTER/ADMIN stay effectively uncapped while remaining operator-editable.
const HOUSEHOLD_PARAM = stageScopeConfig('/wobblio/config/quotas/household_uploads_per_week');
const AVG_TOKENS_PARAM = stageScopeConfig('/wobblio/config/quotas/average_tokens_per_invoice');
// Per-upload size/page limits (§06). Raw byte/page integers — no credit conversion.
const MAX_IMAGE_BYTES_PARAM = stageScopeConfig('/wobblio/config/quotas/max_image_bytes');
const MAX_PDF_BYTES_PARAM = stageScopeConfig('/wobblio/config/quotas/max_pdf_bytes');
const MAX_PDF_PAGES_PARAM = stageScopeConfig('/wobblio/config/quotas/max_pdf_pages');

function uploadsParam(role: UserRole): string {
  return stageScopeConfig(`/wobblio/config/quotas/${role.toLowerCase()}_uploads_per_week`);
}

const ROLES: readonly UserRole[] = ['STANDARD', 'PREMIUM', 'TESTER', 'ADMIN'];

// Failure-refund params were decommissioned in 03 (charging is success-only — there is
// nothing to refund). They are no longer loaded; the SSM values are left in place so a
// stale deploy can't fail closed on a now-irrelevant parameter.
const ALL_PARAMS: string[] = [
  HOUSEHOLD_PARAM,
  AVG_TOKENS_PARAM,
  MAX_IMAGE_BYTES_PARAM,
  MAX_PDF_BYTES_PARAM,
  MAX_PDF_PAGES_PARAM,
  ...ROLES.map(uploadsParam),
];

// Map an invoice limit to its credit cap. -1 → Infinity is applied BEFORE multiplying
// (Infinity × avg stays Infinity), so an unlimited tier never collapses to a number.
function toCreditCap(invoiceLimit: number, avgTokens: number): number {
  return invoiceLimit < 0 ? Number.POSITIVE_INFINITY : invoiceLimit * avgTokens;
}

export class SsmUploadQuotaAdapter implements IUploadQuotaProvider, IUploadLimitsProvider {
  private readonly client: SSMClient;
  private cache: Record<string, number> | null = null;
  private cacheExpiry = 0;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getPersonalUploadsCap(role: UserRole): Promise<number> {
    const caps = await this.load();
    return toCreditCap(caps[uploadsParam(role)], caps[AVG_TOKENS_PARAM]);
  }

  async getHouseholdUploadsCap(): Promise<number> {
    const caps = await this.load();
    return toCreditCap(caps[HOUSEHOLD_PARAM], caps[AVG_TOKENS_PARAM]);
  }

  async getAverageTokensPerInvoice(): Promise<number> {
    return this.value(AVG_TOKENS_PARAM);
  }

  async getMaxImageBytes(): Promise<number> {
    return this.value(MAX_IMAGE_BYTES_PARAM);
  }

  async getMaxPdfBytes(): Promise<number> {
    // Hard-clamp to Bedrock's document limit so a stale/over-set SSM value can't push an
    // oversize PDF past the worker check into a system-fault quarantine (§06 review).
    return Math.min(await this.value(MAX_PDF_BYTES_PARAM), BEDROCK_MAX_PDF_BYTES);
  }

  async getMaxPdfPages(): Promise<number> {
    return this.value(MAX_PDF_PAGES_PARAM);
  }

  // Raw cached value for a single param (the limits are plain integers, no credit
  // conversion). The cap getters keep their own toCreditCap math.
  private async value(param: string): Promise<number> {
    return (await this.load())[param];
  }

  private async load(): Promise<Record<string, number>> {
    if (this.cache && Date.now() < this.cacheExpiry) return this.cache;
    const response = await this.client.send(new GetParametersCommand({ Names: ALL_PARAMS }));
    const caps: Record<string, number> = {};
    for (const param of response.Parameters ?? []) {
      if (param.Name && param.Value) caps[param.Name] = parseInt(param.Value, 10);
    }
    for (const name of ALL_PARAMS) {
      // Fail closed on a missing OR non-integer value: a NaN here would otherwise sail
      // through the size/page guards (`bytes.length > NaN` is false → guard disabled).
      if (caps[name] === undefined || Number.isNaN(caps[name])) {
        throw new Error(`SSM parameter ${name} is missing or not an integer`);
      }
    }
    this.cache = caps;
    this.cacheExpiry = Date.now() + CACHE_TTL_MS;
    return caps;
  }
}
