import type { EscalationThresholds } from '@core/domain/visionEscalation';

// Reads the SSM-configured vision-escalation band cutoffs (fix 11). Fail-open by contract: a
// missing/malformed parameter yields DEFAULT_ESCALATION_THRESHOLDS so the ladder always has a
// safe configuration and an operator can tune it live via Parameter Store without a redeploy.
export interface IEscalationConfig {
  getThresholds(): Promise<EscalationThresholds>;
}
