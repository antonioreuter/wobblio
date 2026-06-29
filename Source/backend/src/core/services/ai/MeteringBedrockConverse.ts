import type { BedrockConverseRequest, BedrockConverseResult, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import type { TokenMeter } from '../../domain/tokenMeter';

// Pass-through decorator that records every Converse call's tokens into a shared meter
// without touching the call sites. This keeps token accounting a cross-cutting concern
// at the port boundary, so the vision/merchant/product/classifier services stay unaware
// of quota — they just call IBedrockConverse.
export class MeteringBedrockConverse implements IBedrockConverse {
  constructor(
    private readonly inner: IBedrockConverse,
    private readonly meter: TokenMeter,
  ) {}

  async converse(request: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const result = await this.inner.converse(request);
    this.meter.record(request.stage, result.inputTokens, result.outputTokens);
    return result;
  }
}
