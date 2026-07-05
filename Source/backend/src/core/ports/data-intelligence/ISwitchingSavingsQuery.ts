import type { SavingsLine } from '../../domain/switchingSavings';

// The caller's own purchase lines paired with their region's median price for each product, over the
// savings window. Reads the RLS-scoped invoice_line joined to the de-identified price_observation
// store, so tenant context MUST be set (the join's regional side is RLS-exempt but the caller side
// is not). Only products meeting the §6.8 quorum contribute a regional median.
export interface SwitchingSavingsInput {
  regionCode: string;
  windowDays: number; // e.g. 365 for "this year"
  minObservations?: number; // §6.8 serving gate k; defaults to 3
}

export interface ISwitchingSavingsQuery {
  savingsLines(input: SwitchingSavingsInput): Promise<SavingsLine[]>;
}
