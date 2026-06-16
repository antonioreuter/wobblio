import { macroCategoryId } from './categoryTaxonomy';

// Invoice classification by line-item spend share (§6.4). Line categories are rolled
// up to their macro so the invoice always gets a macro category; the dominant macro by
// share wins, and if none clears 50% the caller resolves the tie (merchant prior or an
// LLM tiebreak). Shares use absolute line totals so discounts don't skew them.

export interface CategoryVoteLine {
  categoryId: string | null;
  lineTotal: number;
}

export interface CategoryVote {
  categoryId: string | null;
  topShare: number; // 0..1
  needsTiebreak: boolean;
}

const MAJORITY_SHARE = 0.5;

export function voteCategory(lines: CategoryVoteLine[]): CategoryVote {
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const line of lines) {
    const weight = Math.abs(line.lineTotal);
    if (line.categoryId === null || weight === 0) continue;
    const macro = macroCategoryId(line.categoryId);
    totals.set(macro, (totals.get(macro) ?? 0) + weight);
    grandTotal += weight;
  }

  if (grandTotal === 0) {
    return { categoryId: null, topShare: 0, needsTiebreak: true };
  }

  let winner: string | null = null;
  let winnerTotal = 0;
  for (const [categoryId, total] of totals) {
    if (total > winnerTotal) {
      winner = categoryId;
      winnerTotal = total;
    }
  }

  const topShare = winnerTotal / grandTotal;
  return { categoryId: winner, topShare, needsTiebreak: topShare <= MAJORITY_SHARE };
}

// Spend share per category (absolute totals), for §6.10 tag triggers. Each line's
// spend is counted under both its own (sub-)category and its parent macro, so a trigger
// keyed on a macro (e.g. weekly-groceries → cat-groceries) sees the rolled-up share.
export function categoryShares(lines: CategoryVoteLine[]): Record<string, number> {
  const totals: Record<string, number> = {};
  let grandTotal = 0;
  for (const line of lines) {
    const weight = Math.abs(line.lineTotal);
    if (line.categoryId === null || weight === 0) continue;
    grandTotal += weight;
    totals[line.categoryId] = (totals[line.categoryId] ?? 0) + weight;
    const macro = macroCategoryId(line.categoryId);
    if (macro !== line.categoryId) totals[macro] = (totals[macro] ?? 0) + weight;
  }
  if (grandTotal === 0) return {};
  const shares: Record<string, number> = {};
  for (const [categoryId, total] of Object.entries(totals)) {
    shares[categoryId] = total / grandTotal;
  }
  return shares;
}
