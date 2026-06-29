import { UnknownAdminTargetError } from '@core/domain/errors';

// Allowlist of boolean runtime feature flags an operator may toggle (NF-01/05). Anything not
// here is rejected — no arbitrary SSM writes. `feature` is the flat id used in the toggle body;
// `ssmPath` is the real Parameter Store path the routing adapter reads (stage-scoped at runtime).
export interface FeatureFlag {
  feature: string;
  label: string;
  ssmPath: string;
}

export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  {
    feature: 'agentic_pipeline_enabled',
    label: 'Agentic ingestion pipeline',
    ssmPath: '/wobblio/config/features/agentic_pipeline_enabled',
  },
];

export function findFeatureFlag(feature: string): FeatureFlag {
  const flag = FEATURE_FLAGS.find((f) => f.feature === feature);
  if (!flag) throw new UnknownAdminTargetError(feature);
  return flag;
}

// SSM stores the flag as a string; routing treats 'true'/'1' as on (see
// SqsInvoiceIngestionQueueAdapter). A missing/unset value is off.
export function isFlagEnabled(raw: string | null | undefined): boolean {
  return raw === 'true' || raw === '1';
}
