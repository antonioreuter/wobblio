import type { BedrockImage, BedrockDocument } from '../../ports/ai/IBedrockConverse';
import type { IReceiptParser, ReceiptContext } from '../../ports/ingestion/IReceiptParser';
import { isUnreadableVerdict, type ParsedReceipt, type UnreadableVerdict } from '../../domain/ingestion';
import { shouldEscalate, type EscalationDecision } from '../../domain/receiptEscalation';

// Generalizes the PDF→doc-model routing to hard image receipts: parses with the primary
// (cheap) model, and when the parse looks unreliable (shouldEscalate) re-parses the SAME
// attachment with a more powerful fallback model, taking the better result. One re-parse
// max — the fallback result is never itself escalated.
export class EscalatingReceiptParser implements IReceiptParser {
  constructor(
    private readonly primary: IReceiptParser,
    private readonly fallback: IReceiptParser,
    private readonly decide: (parsed: ParsedReceipt | UnreadableVerdict) => EscalationDecision = shouldEscalate,
  ) {}

  async parse(attachment: BedrockImage | BedrockDocument, ctx: ReceiptContext): Promise<ParsedReceipt | UnreadableVerdict> {
    const first = await this.primary.parse(attachment, ctx);
    if (!this.decide(first).escalate) return first;

    // Best-effort: the fallback only ever tries to improve a parse the primary already produced,
    // so a fallback-model outage/throttle must degrade to the primary result — never fail an
    // invoice the primary already parsed. (The primary tripped escalation, so it still flows to
    // review downstream.) A throw here would otherwise retry/DLQ the whole ingestion.
    let second: ParsedReceipt | UnreadableVerdict;
    try {
      second = await this.fallback.parse(attachment, ctx);
    } catch {
      return first;
    }
    // Never regress: if the fallback can't read an image the primary did read, keep the primary.
    if (isUnreadableVerdict(second) && !isUnreadableVerdict(first)) return first;
    return second;
  }
}
