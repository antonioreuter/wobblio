import type { IKpiDailyReader, KpiPoint } from '@core/ports/observability/IKpiDailyReader';
import type {
  IBedrockCostSource,
  CostGranularity,
  ModelCostPoint,
} from '@core/ports/observability/IBedrockCostSource';
import { resolveRange } from '@core/domain/kpiRange';
import { AI_TOKENS_METRIC, AI_COST_METRIC } from '@core/domain/aiSpend';
import { InvalidAdminInputError } from '@core/domain/errors';

const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AiSpendResult {
  from: string;
  to: string;
  points: KpiPoint[]; // ai_tokens / ai_cost rows, each carrying { model_role } in dimensions
}

export interface ActualSpendResult {
  from: string;
  to: string;
  granularity: CostGranularity;
  points: ModelCostPoint[];
}

// AI-spend (admin-console 07). Two sources:
//  - estimated: near-real-time per-model-role tokens + estimated cost from kpi_daily
//    (rolled up nightly from bedrock_usage logs).
//  - actual: billed per-model cost from AWS Cost Explorer (lags ~24-48h).
export class AdminAiSpendService {
  constructor(
    private readonly reader: IKpiDailyReader,
    private readonly costSource?: IBedrockCostSource,
  ) {}

  async query(from: string | undefined, to: string | undefined): Promise<AiSpendResult> {
    const range = resolveRange(from, to, DEFAULT_RANGE_DAYS);
    const points = await this.reader.query([AI_TOKENS_METRIC, AI_COST_METRIC], range.from, range.to);
    return { ...range, points };
  }

  async actual(
    granularityRaw: string | undefined,
    from: string | undefined,
    to: string | undefined,
  ): Promise<ActualSpendResult> {
    if (!this.costSource) throw new InvalidAdminInputError('cost source not configured');
    const granularity = parseGranularity(granularityRaw);
    const range = resolveRange(from, to, DEFAULT_RANGE_DAYS);
    // Cost Explorer treats the period End as exclusive; include the `to` day.
    const endExclusive = nextDay(range.to);
    const points = await this.costSource.getByModel(granularity, range.from, endExclusive);
    return { from: range.from, to: range.to, granularity, points };
  }
}

function parseGranularity(value: string | undefined): CostGranularity {
  if (value === undefined || value === '' || value === 'DAILY') return 'DAILY';
  if (value === 'MONTHLY') return 'MONTHLY';
  throw new InvalidAdminInputError("granularity must be 'DAILY' or 'MONTHLY'");
}

function nextDay(isoDate: string): string {
  return new Date(Date.parse(isoDate) + DAY_MS).toISOString().slice(0, 10);
}
