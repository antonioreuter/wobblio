import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import { KpiDailyReaderAdapter } from '@infrastructure/adapters/observability/KpiDailyReaderAdapter';
import { CostExplorerBedrockAdapter } from '@infrastructure/adapters/observability/CostExplorerBedrockAdapter';
import { AdminKpiService } from '@core/services/admin/AdminKpiService';
import { AdminAiSpendService } from '@core/services/admin/AdminAiSpendService';
import { InvalidAdminInputError } from '@core/domain/errors';
import { json } from './shared';

// Read-only dashboards over kpi_daily — KPI dashboard (08) + AI-spend (07). No audit
// (reads), no tenant context (kpi_daily is global).
export async function handleAdminAnalyticsRoute(
  db: PoolClient,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method !== 'GET') return json(405, { message: 'Method Not Allowed' });
  const reader = new KpiDailyReaderAdapter(db);
  const q = event.queryStringParameters ?? {};

  try {
    if (path === '/admin/kpis') {
      return json(200, await new AdminKpiService(reader).query(q.metrics, q.from, q.to));
    }
    if (path === '/admin/ai-spend') {
      return json(200, await new AdminAiSpendService(reader).query(q.from, q.to));
    }
    if (path === '/admin/ai-spend/actual') {
      const service = new AdminAiSpendService(reader, new CostExplorerBedrockAdapter());
      return json(200, await service.actual(q.granularity, q.from, q.to));
    }
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }

  return json(404, { message: 'Not Found' });
}
