import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult } from '../ports/IBedrockConverse';
import type { IAiSpendLedger } from '../ports/IAiSpendLedger';
import type { IAiSpendCapProvider } from '../ports/IAiSpendCapProvider';
import { AiSpendCapExceededError } from '../domain/errors';

const INPUT_RATE_PER_1K = 0.00025;
const OUTPUT_RATE_PER_1K = 0.00125;

export function estimateCostEur(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * INPUT_RATE_PER_1K + (outputTokens / 1000) * OUTPUT_RATE_PER_1K;
}

export class BedrockSpendGuardService {
  constructor(
    private readonly conversePort: IBedrockConverse,
    private readonly spendLedger: IAiSpendLedger,
    private readonly capProvider: IAiSpendCapProvider,
  ) {}

  async callWithSpendGuard(
    tenantId: string,
    request: BedrockConverseRequest,
  ): Promise<BedrockConverseResult> {
    const today = new Date().toISOString().slice(0, 10);
    const currentSpend = await this.spendLedger.getDailyTotal(tenantId, today);
    const cap = await this.capProvider.getDailyCapEur();

    if (currentSpend >= cap) {
      throw new AiSpendCapExceededError(tenantId, currentSpend, cap);
    }

    const result = await this.conversePort.converse(request);
    const { inputTokens, outputTokens } = result;
    const estCost = estimateCostEur(inputTokens, outputTokens);

    await this.spendLedger.record({
      tenantId,
      date: today,
      modelRole: request.stage,
      inputTokens,
      outputTokens,
      estCost,
    });

    return result;
  }
}
