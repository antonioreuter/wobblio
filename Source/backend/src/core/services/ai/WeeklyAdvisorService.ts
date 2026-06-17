import type { IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import type { IWeeklyAdvisorRepository, AdvisorTenant } from '../../ports/ai/IWeeklyAdvisorRepository';
import { buildFactsXml, clampWords, type AdvisorFacts } from '../../domain/weeklyAdvisor';
import { weekStart } from '../../domain/week';

const MAX_WORDS = 120;
const MAX_OUTPUT_TOKENS = 300;
// Bounded fan-out: cap concurrent Bedrock calls so the cron clears its window
// without overrunning the per-tenant connection/token budget (§10, §7.3.1).
const MAX_CONCURRENCY = 8;

export interface AdvisorRunOutcome {
  eligible: number;
  generated: number;
}

// Weekly EventBridge cron (§10). One auxiliary-model (Haiku-class) call per eligible
// Premium user, run through a bounded promise pool; the prompt + version are injected
// (handlers own prompt artifacts). A single tenant's failure is isolated so the rest
// of the cohort still runs. Batch Inference is deferred until the cohort reaches the
// ≥100-record floor — see docs/deferred/weekly-advisor-batch-inference.md.
export class WeeklyAdvisorService {
  constructor(
    private readonly advisor: IWeeklyAdvisorRepository,
    private readonly converse: IBedrockConverse,
    private readonly modelId: string,
    private readonly systemPrompt: string,
    private readonly promptVersion: string,
  ) {}

  async run(today: string): Promise<AdvisorRunOutcome> {
    const week = weekStart(today);
    const tenants = await this.advisor.listEligibleTenants(week);

    const results = await mapWithConcurrency(tenants, MAX_CONCURRENCY, tenant =>
      this.generateFor(tenant, week),
    );
    return { eligible: tenants.length, generated: results.filter(Boolean).length };
  }

  private async generateFor(tenant: AdvisorTenant, week: string): Promise<boolean> {
    try {
      const data = await this.advisor.gatherFacts(tenant.tenantId, week);
      const facts: AdvisorFacts = { language: tenant.language, currency: tenant.currency, ...data };
      const result = await this.converse.converse({
        modelId: this.modelId,
        stage: 'WEEKLY_ADVISOR',
        systemPrompt: this.systemPrompt,
        promptVersion: this.promptVersion,
        messages: [{ role: 'user', content: buildFactsXml(facts) }],
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.4,
      });
      await this.advisor.save(tenant.tenantId, week, clampWords(result.content.trim(), MAX_WORDS));
      return true;
    } catch {
      return false;
    }
  }
}

// Worker-pool map: at most `limit` invocations of fn run at once. Results keep input
// order; fn is expected to never reject (generateFor isolates its own failures).
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
