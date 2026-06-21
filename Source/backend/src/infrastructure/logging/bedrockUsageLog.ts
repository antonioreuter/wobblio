import pino from 'pino';
import type { BedrockStage } from '@core/ports/ai/IBedrockConverse';

// Per-call Bedrock token/latency telemetry as a plain structured log line (no EMF
// envelope) — CloudWatch Logs keeps it, but no billable custom metric is extracted.
// A metric filter or the daily kpi_daily roll-up can re-derive numbers on demand.
const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.DEBUG ? 'debug' : 'info'),
}).child({ service: 'bedrock-usage' });

export function logBedrockUsage(
  stage: BedrockStage,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
): void {
  logger.info({ event: 'bedrock_usage', stage, modelId, inputTokens, outputTokens, durationMs });
}
