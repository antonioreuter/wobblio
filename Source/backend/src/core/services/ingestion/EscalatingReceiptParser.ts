import type { BedrockImage, BedrockDocument } from '../../ports/ai/IBedrockConverse';
import type { IReceiptParser, ReceiptContext } from '../../ports/ingestion/IReceiptParser';
import { isUnreadableVerdict, type ParsedReceipt, type UnreadableVerdict } from '../../domain/ingestion';
import { shouldEscalate, type EscalationDecision, type EscalationReason } from '../../domain/receiptEscalation';

// What happened once a parse tripped escalation — reported to the optional sink so operators
// can see how often the fallback runs, why, and whether it actually got used.
export interface EscalationOutcome {
  reason: EscalationReason;
  usedFallback: boolean; // the fallback result was taken
  fallbackErrored: boolean; // the fallback call threw (degraded to primary)
}

// Fire-and-forget escalation reporter. Injected as a closure from the handler so the parser
// stays free of any logger/SDK (hexagonal); a throw here must never affect the parse outcome.
export type EscalationSink = (outcome: EscalationOutcome) => void;

// Generalizes the PDF→doc-model routing to hard image receipts: parses with the primary
// (cheap) model, and when the parse looks unreliable (shouldEscalate) re-parses the SAME
// attachment with a more powerful fallback model, taking the better result. One re-parse
// max — the fallback result is never itself escalated.
export class EscalatingReceiptParser implements IReceiptParser {
  constructor(
    private readonly primary: IReceiptParser,
    private readonly fallback: IReceiptParser,
    private readonly decide: (parsed: ParsedReceipt | UnreadableVerdict) => EscalationDecision = shouldEscalate,
    private readonly onEscalation?: EscalationSink,
  ) {}

  async parse(attachment: BedrockImage | BedrockDocument, ctx: ReceiptContext): Promise<ParsedReceipt | UnreadableVerdict> {
    const first = await this.primary.parse(attachment, ctx);
    const decision = this.decide(first);
    if (!decision.escalate) return first;
    const reason = decision.reason!;

    // Best-effort: the fallback only ever tries to improve a parse the primary already produced,
    // so a fallback-model outage/throttle must degrade to the primary result — never fail an
    // invoice the primary already parsed. (The primary tripped escalation, so it still flows to
    // review downstream.) A throw here would otherwise retry/DLQ the whole ingestion.
    let second: ParsedReceipt | UnreadableVerdict;
    try {
      second = await this.fallback.parse(attachment, ctx);
    } catch {
      this.report({ reason, usedFallback: false, fallbackErrored: true });
      return first;
    }
    // Never regress: if the fallback can't read an image the primary did read, keep the primary.
    if (isUnreadableVerdict(second) && !isUnreadableVerdict(first)) {
      this.report({ reason, usedFallback: false, fallbackErrored: false });
      return first;
    }
    this.report({ reason, usedFallback: true, fallbackErrored: false });
    return second;
  }

  // The sink is best-effort telemetry — a broken sink must not change the parse outcome.
  private report(outcome: EscalationOutcome): void {
    try {
      this.onEscalation?.(outcome);
    } catch {
      // Ignore — escalation reporting must never affect ingestion.
    }
  }
}
