import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import type {
  IBedrockCostSource,
  CostGranularity,
  ModelCostPoint,
} from '@core/ports/observability/IBedrockCostSource';
import { parseBedrockModel } from '@core/domain/bedrockUsageType';

// Actual billed Bedrock cost per model from AWS Cost Explorer, grouped by
// USAGE_TYPE (which encodes the model). CE is a global service — the client must
// target us-east-1. UsageQuantity for token usage types is in 1K-token units.
export class CostExplorerBedrockAdapter implements IBedrockCostSource {
  private readonly client: CostExplorerClient;

  constructor() {
    this.client = new CostExplorerClient({ region: 'us-east-1' });
  }

  async getByModel(granularity: CostGranularity, from: string, to: string): Promise<ModelCostPoint[]> {
    const response = await this.client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: from, End: to },
        Granularity: granularity,
        Metrics: ['UnblendedCost', 'UsageQuantity'],
        Filter: { Dimensions: { Key: 'SERVICE', Values: ['Amazon Bedrock'] } },
        GroupBy: [{ Type: 'DIMENSION', Key: 'USAGE_TYPE' }],
      }),
    );

    const points: ModelCostPoint[] = [];
    for (const period of response.ResultsByTime ?? []) {
      const periodStart = period.TimePeriod?.Start ?? '';
      const byModel = new Map<string, { cost: number; tokens: number }>();
      for (const group of period.Groups ?? []) {
        const model = parseBedrockModel(group.Keys?.[0] ?? '');
        const cost = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);
        const tokens1k = Number(group.Metrics?.UsageQuantity?.Amount ?? 0);
        const acc = byModel.get(model) ?? { cost: 0, tokens: 0 };
        acc.cost += cost;
        acc.tokens += tokens1k * 1000;
        byModel.set(model, acc);
      }
      for (const [model, totals] of byModel) {
        points.push({
          periodStart,
          model,
          cost: Math.round(totals.cost * 1e6) / 1e6,
          tokens: Math.round(totals.tokens),
        });
      }
    }
    return points;
  }
}
