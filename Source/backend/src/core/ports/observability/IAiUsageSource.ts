import type { BedrockStage } from '@core/ports/ai/IBedrockConverse';

// Per-stage Bedrock token totals for one UTC day, from the bedrock_usage structured
// logs via a Logs Insights query (Epic 15 / admin-console 07). Stages map to model
// roles in the domain (aiSpend).
export interface StageTokenTotals {
  stage: BedrockStage | string;
  inputTokens: number;
  outputTokens: number;
}

export interface IAiUsageSource {
  getDailyTokensByStage(metricDate: string): Promise<StageTokenTotals[]>;
}
