import type { BedrockImage, BedrockDocument } from '../../ports/ai/IBedrockConverse';
import type { IReceiptParser, ReceiptContext } from '../../ports/ingestion/IReceiptParser';
import { isUnreadableVerdict, type ParsedReceipt, type UnreadableVerdict } from '../../domain/ingestion';
import { decideReceiptEscalation, type EscalationReason, type ReceiptEscalationDecision } from '../../domain/receiptEscalation';
import type { EscalationTier, EscalationThresholds, QualityScore } from '../../domain/visionEscalation';

// The stronger parsers a low-quality primary parse can escalate to, keyed by tier. Either may be
// absent (its SSM model id unprovisioned) — a missing deep tier degrades to the mid tier, and a
// missing target degrades to the primary, so escalation is always fail-open.
export type EscalationTargets = Partial<Record<Exclude<EscalationTier, 'NONE'>, IReceiptParser>>;

// What happened once a parse tripped escalation — reported to the optional sink so operators can
// monitor how often each tier runs, why, and whether it was actually used (fix 11 decision 2).
export interface EscalationOutcome {
  tier: Exclude<EscalationTier, 'NONE'>; // the tier the decision asked for
  ranTier: Exclude<EscalationTier, 'NONE'>; // the tier actually invoked (deep→mid degrade)
  reason?: EscalationReason;
  score?: QualityScore;
  usedFallback: boolean; // the fallback result was taken
  fallbackErrored: boolean; // the fallback call threw (degraded to primary)
}

// Fire-and-forget escalation reporter. Injected as a closure from the handler so the parser stays
// free of any logger/SDK (hexagonal); a throw here must never affect the parse outcome.
export type EscalationSink = (outcome: EscalationOutcome) => void;

type Decider = (parsed: ParsedReceipt | UnreadableVerdict) => ReceiptEscalationDecision;

// Parses with the primary (cheap) model, and when the parse looks unreliable re-parses the SAME
// attachment on a stronger model — the mid or deep tier chosen by the blended-quality band — and
// takes the better result. One re-parse max; the fallback result is never itself escalated.
export class EscalatingReceiptParser implements IReceiptParser {
  constructor(
    private readonly primary: IReceiptParser,
    private readonly targets: EscalationTargets,
    private readonly thresholds: EscalationThresholds,
    private readonly onEscalation?: EscalationSink,
    private readonly decide: Decider = (parsed) => decideReceiptEscalation(parsed, this.thresholds),
  ) {}

  async parse(attachment: BedrockImage | BedrockDocument, ctx: ReceiptContext): Promise<ParsedReceipt | UnreadableVerdict> {
    const first = await this.primary.parse(attachment, ctx);
    const decision = this.decide(first);
    if (decision.tier === 'NONE') return first;

    const resolved = this.resolveTarget(decision.tier);
    if (!resolved) return first; // no tier provisioned — behave exactly as the primary alone
    const { ranTier, parser } = resolved;
    const base = { tier: decision.tier, ranTier, reason: decision.reason, score: decision.score };

    // Best-effort: the fallback only tries to improve a parse the primary already produced, so a
    // fallback-model outage/throttle must degrade to the primary result — never fail an invoice the
    // primary already parsed (it tripped escalation, so it still flows to review downstream).
    let second: ParsedReceipt | UnreadableVerdict;
    try {
      second = await parser.parse(attachment, ctx);
    } catch {
      this.report({ ...base, usedFallback: false, fallbackErrored: true });
      return first;
    }
    // Never regress: if the fallback can't read an image the primary did read, keep the primary.
    if (isUnreadableVerdict(second) && !isUnreadableVerdict(first)) {
      this.report({ ...base, usedFallback: false, fallbackErrored: false });
      return first;
    }
    this.report({ ...base, usedFallback: true, fallbackErrored: false });
    return second;
  }

  // Resolve the requested tier to a provisioned parser, degrading across whichever tier is missing
  // rather than skipping escalation: a deep request with only the mid tier uses the mid model, and
  // a mid request with only the deep tier uses the (stronger) deep model. Only a fully-unprovisioned
  // set returns null (→ primary unchanged).
  private resolveTarget(tier: Exclude<EscalationTier, 'NONE'>): { ranTier: Exclude<EscalationTier, 'NONE'>; parser: IReceiptParser } | null {
    const exact = this.targets[tier];
    if (exact) return { ranTier: tier, parser: exact };
    if (tier === 'FALLBACK_DEEP' && this.targets.FALLBACK) return { ranTier: 'FALLBACK', parser: this.targets.FALLBACK };
    if (tier === 'FALLBACK' && this.targets.FALLBACK_DEEP) return { ranTier: 'FALLBACK_DEEP', parser: this.targets.FALLBACK_DEEP };
    return null;
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
