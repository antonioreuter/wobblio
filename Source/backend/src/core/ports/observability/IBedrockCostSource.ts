export type CostGranularity = 'DAILY' | 'MONTHLY';

// One actual-billed cost point for a Bedrock model in a period (from AWS Cost
// Explorer). cost is UnblendedCost in USD; tokens is the approximate token count.
export interface ModelCostPoint {
  periodStart: string; // YYYY-MM-DD
  model: string;
  cost: number;
  tokens: number;
}

export interface IBedrockCostSource {
  // `to` is exclusive (Cost Explorer convention).
  getByModel(granularity: CostGranularity, from: string, to: string): Promise<ModelCostPoint[]>;
}
