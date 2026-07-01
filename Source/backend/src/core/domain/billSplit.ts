import { roundTo } from './unitSize';

// A parsed invoice line as the splitter sees it. Discount and deposit/fee lines are never
// assignable — they form the proportionally-allocated fee pool (§11 splitting).
export interface SplitLine {
  id: string;
  label: string;
  quantity: number;
  lineTotal: number;
  isDiscount: boolean;
  isDepositOrFee: boolean;
}

// One line attributed to one named participant (PK split_id,line_id → at most one per line).
// `participantName` is already decrypted by the service before it reaches this pure domain.
export interface SplitAssignment {
  lineId: string;
  participantName: string;
  fraction: number;
}

export interface SplitItem {
  lineId: string;
  label: string;
  qty: number;
  fraction: number;
  amount: number;
}

export interface SplitParticipant {
  name: string;
  subtotal: number;
  fees: number;
  total: number;
  items: SplitItem[];
}

export interface SplitSummary {
  participants: SplitParticipant[];
  grandTotal: number;
}

const EPSILON = 1e-9;

// Proportional split of a printed invoice. Named participants take the fractions assigned to them;
// every unassigned product-line remainder falls to the account holder (`ownerLabel`), so the split
// is always complete and Σ participant totals === grandTotal (= printed invoice total). Fees (taxes,
// tips, service = invoiceTotal − Σ product lines) are spread by each participant's subtotal share.
export function computeSplitSummary(
  lines: SplitLine[],
  assignments: SplitAssignment[],
  invoiceTotal: number,
  ownerLabel = 'You',
): SplitSummary {
  const grandTotal = roundTo(invoiceTotal, 2);
  const productLines = lines.filter((l) => !l.isDiscount && !l.isDepositOrFee);
  const assignableSubtotal = productLines.reduce((sum, l) => sum + l.lineTotal, 0);
  if (assignableSubtotal <= EPSILON) return { participants: [], grandTotal };

  const feePool = invoiceTotal - assignableSubtotal;
  const draft = buildParticipants(productLines, assignments, ownerLabel);
  const priced = draft.map((p) => applyFees(p, assignableSubtotal, feePool));
  return { participants: reconcile(priced, grandTotal), grandTotal };
}

// Named participants (grouped by decrypted name, first-seen order) plus the owner bucket, which
// collects every line's un-assigned remainder. Assignments to non-product lines are ignored here.
function buildParticipants(
  productLines: SplitLine[],
  assignments: SplitAssignment[],
  ownerLabel: string,
): { name: string; subtotal: number; items: SplitItem[] }[] {
  const byLine = new Map(productLines.map((l) => [l.id, l]));
  const named = new Map<string, { name: string; subtotal: number; items: SplitItem[] }>();
  const assignedFraction = new Map<string, number>();

  for (const a of assignments) {
    const line = byLine.get(a.lineId);
    if (!line) continue;
    assignedFraction.set(a.lineId, a.fraction);
    const bucket = named.get(a.participantName) ?? { name: a.participantName, subtotal: 0, items: [] };
    bucket.items.push(toItem(line, a.fraction));
    bucket.subtotal += line.lineTotal * a.fraction;
    named.set(a.participantName, bucket);
  }

  const owner = ownerBucket(productLines, assignedFraction, ownerLabel);
  const participants = [...named.values()];
  if (owner) participants.push(owner);
  return participants;
}

function ownerBucket(
  productLines: SplitLine[],
  assignedFraction: Map<string, number>,
  ownerLabel: string,
): { name: string; subtotal: number; items: SplitItem[] } | null {
  const owner = { name: ownerLabel, subtotal: 0, items: [] as SplitItem[] };
  for (const line of productLines) {
    const remainder = 1 - (assignedFraction.get(line.id) ?? 0);
    if (remainder <= EPSILON) continue;
    owner.items.push(toItem(line, remainder));
    owner.subtotal += line.lineTotal * remainder;
  }
  return owner.subtotal > EPSILON ? owner : null;
}

function toItem(line: SplitLine, fraction: number): SplitItem {
  return {
    lineId: line.id,
    label: line.label,
    qty: roundTo(line.quantity * fraction, 2),
    fraction: roundTo(fraction, 4),
    amount: roundTo(line.lineTotal * fraction, 2),
  };
}

function applyFees(
  p: { name: string; subtotal: number; items: SplitItem[] },
  assignableSubtotal: number,
  feePool: number,
): SplitParticipant {
  const share = p.subtotal / assignableSubtotal;
  const subtotal = roundTo(p.subtotal, 2);
  const fees = roundTo(feePool * share, 2);
  return { name: p.name, subtotal, fees, total: roundTo(p.subtotal + feePool * share, 2), items: p.items };
}

// Nudge any 2dp rounding residual onto the largest participant so the parts sum to the printed total.
function reconcile(participants: SplitParticipant[], grandTotal: number): SplitParticipant[] {
  if (participants.length === 0) return participants;
  const summed = roundTo(participants.reduce((s, p) => s + p.total, 0), 2);
  const residual = roundTo(grandTotal - summed, 2);
  if (Math.abs(residual) <= EPSILON) return participants;

  const largest = participants.reduce((a, b) => (b.total > a.total ? b : a));
  largest.total = roundTo(largest.total + residual, 2);
  largest.fees = roundTo(largest.total - largest.subtotal, 2);
  return participants;
}
