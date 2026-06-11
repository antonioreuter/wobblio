import { createMetricsLogger, Unit } from 'aws-embedded-metrics';
import type { BedrockStage } from '@core/ports/IBedrockConverse';

export async function emitBedrockTokenMetric(
  stage: BedrockStage,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
): Promise<void> {
  const metrics = createMetricsLogger();
  metrics.putDimensions({ Stage: stage, ModelId: modelId });
  metrics.putMetric('InputTokens', inputTokens, Unit.Count);
  metrics.putMetric('OutputTokens', outputTokens, Unit.Count);
  metrics.putMetric('DurationMs', durationMs, Unit.Milliseconds);
  await metrics.flush();
}
