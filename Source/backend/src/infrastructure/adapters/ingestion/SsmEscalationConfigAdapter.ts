import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { IEscalationConfig } from '@core/ports/ingestion/IEscalationConfig';
import { DEFAULT_ESCALATION_THRESHOLDS, type EscalationThresholds } from '@core/domain/visionEscalation';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const PARAM = stageScopeConfig('/wobblio/config/ingestion/vision_escalation');

const isFraction = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;

// Accepts only a well-formed, ordered config; anything else falls back to defaults (fail-open).
// retakeResidualPct is optional in the stored config — a param written before this field existed
// still parses, defaulting that one threshold rather than discarding the whole tune.
function parseThresholds(raw: string): EscalationThresholds {
  const parsed = JSON.parse(raw) as Partial<EscalationThresholds>;
  const { acceptMin, deepMax, reconciliationTolerancePct } = parsed;
  if (!isFraction(acceptMin) || !isFraction(deepMax) || !isFraction(reconciliationTolerancePct)) {
    return DEFAULT_ESCALATION_THRESHOLDS;
  }
  if (deepMax >= acceptMin || reconciliationTolerancePct <= 0) return DEFAULT_ESCALATION_THRESHOLDS;
  const retakeResidualPct = isFraction(parsed.retakeResidualPct)
    ? parsed.retakeResidualPct
    : DEFAULT_ESCALATION_THRESHOLDS.retakeResidualPct;
  return { acceptMin, deepMax, reconciliationTolerancePct, retakeResidualPct };
}

// Warm-container memo: the worker constructs a fresh adapter per invocation, so the cache must live
// at module scope to actually save the repeated SSM read (an instance field never survived and was
// dead — fix 11 review ⑧). A tune is picked up on the next cold start, matching model-registry behaviour.
let cachedThresholds: EscalationThresholds | null = null;

// SSM param /wobblio/config/<stage>/ingestion/vision_escalation, e.g.
// {"acceptMin":0.88,"deepMax":0.55,"reconciliationTolerancePct":0.02,"retakeResidualPct":0.15}.
export class SsmEscalationConfigAdapter implements IEscalationConfig {
  private readonly client: SSMClient;

  constructor(region: string) {
    this.client = new SSMClient({ region });
  }

  async getThresholds(): Promise<EscalationThresholds> {
    if (cachedThresholds) return cachedThresholds;
    cachedThresholds = await this.load();
    return cachedThresholds;
  }

  private async load(): Promise<EscalationThresholds> {
    try {
      const response = await this.client.send(new GetParameterCommand({ Name: PARAM }));
      const value = response.Parameter?.Value;
      return value ? parseThresholds(value) : DEFAULT_ESCALATION_THRESHOLDS;
    } catch {
      return DEFAULT_ESCALATION_THRESHOLDS; // unprovisioned / unreadable → safe defaults
    }
  }
}
