import pino from 'pino';
import type { AgenticStage } from '@core/domain/agenticStage';
import type { IAgenticStageInstrumentation } from '@core/ports/observability/IAgenticStageInstrumentation';
import { resolveLogLevel } from '@infrastructure/logging/logger';

// Per-stage coordinator outcome as a plain structured log line (mirrors bedrockUsageLog.ts) —
// CloudWatch Logs Insights re-derives per-stage health for the admin Troubleshooting page
// (CloudWatchLogsAgenticStageHealthAdapter), no billable custom metric extracted.
const logger = pino({ level: resolveLogLevel() }).child({ service: 'agentic-stage' });

export class StructuredLogAgenticStageInstrumentation implements IAgenticStageInstrumentation {
  recordStageOutcome(stage: AgenticStage, invoiceId: string, durationMs: number, error?: string): void {
    // `outcome` as a string (not a boolean `success`) so the Logs Insights aggregate query
    // (CloudWatchLogsAgenticStageHealthAdapter) can filter/sum on it without boolean-field quirks.
    logger.info({ event: 'agentic_stage', stage, invoiceId, durationMs, outcome: error ? 'error' : 'ok', error });
  }
}
