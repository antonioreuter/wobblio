import type { BedrockStage } from '@core/ports/ai/IBedrockConverse';
import type { StageTokenTotals } from '@core/ports/observability/IAiUsageSource';

// Accumulates LLM token usage across every model call in one ingestion run. The worker
// charges the actual credits consumed off `total` (1 credit = 1 token) and derives the
// telemetry cost estimate off the per-stage breakdown — stages map to model roles, each
// with its own price (aiSpend.estimateCostUsd). One instance per message; the metering
// port decorators record into it.
export class TokenMeter {
  private input = 0;
  private output = 0;
  private readonly byStage = new Map<BedrockStage, { input: number; output: number }>();

  record(stage: BedrockStage, inputTokens: number, outputTokens: number): void {
    this.input += inputTokens;
    this.output += outputTokens;
    const acc = this.byStage.get(stage) ?? { input: 0, output: 0 };
    acc.input += inputTokens;
    acc.output += outputTokens;
    this.byStage.set(stage, acc);
  }

  get total(): number {
    return this.input + this.output;
  }

  get inputTotal(): number {
    return this.input;
  }

  get outputTotal(): number {
    return this.output;
  }

  stageBreakdown(): StageTokenTotals[] {
    return [...this.byStage].map(([stage, t]) => ({
      stage,
      inputTokens: t.input,
      outputTokens: t.output,
    }));
  }
}
