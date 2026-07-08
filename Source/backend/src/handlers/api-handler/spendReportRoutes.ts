import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/identity/AppUserRepositoryAdapter';
import { SpendReportQueryAdapter } from '@infrastructure/adapters/reporting/SpendReportQueryAdapter';
import { SpendReportService, type SpendReportParams } from '@core/services/reporting/SpendReportService';
import { isSpendPeriodPreset } from '@core/domain/reportPeriod';
import { isSpendReportView } from '@core/domain/spendReport';
import { PremiumRequiredError, InvalidSpendReportQueryError } from '@core/domain/errors';
import { json, withTenantTx } from './shared';

// The hierarchical spend-breakdown report (category → merchant → item-category → items).
// Drilling into a merchant (item-category / item level) is Premium-only; TESTER and ADMIN
// get it too (operator/QA access). Category and merchant levels are open to every tier.
const PREMIUM_ROLES = new Set<AppUser['role']>(['PREMIUM', 'TESTER', 'ADMIN']);

// GET /reports/spend?period=&from=&to=&country=&region=&categoryId=&merchantId=&itemCategoryId=
// Drill level is inferred from which selection params are present (see SpendReportService).
export async function handleSpendReportRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method !== 'GET' || path !== '/reports/spend') return json(404, { message: 'Not Found' });

  const query = event.queryStringParameters ?? {};
  const presetRaw = query.period ?? 'LAST_90D';
  if (!isSpendPeriodPreset(presetRaw)) {
    return json(400, { message: 'period must be TODAY, THIS_WEEK, THIS_MONTH, LAST_90D or CUSTOM' });
  }

  const viewRaw = query.view ?? 'merchant';
  if (!isSpendReportView(viewRaw)) {
    return json(400, { message: 'view must be merchant or product' });
  }

  const params: SpendReportParams = {
    preset: presetRaw,
    from: emptyToNull(query.from),
    to: emptyToNull(query.to),
    country: (query.country ?? '').toUpperCase(),
    region: query.region ?? '',
    view: viewRaw,
    categoryId: emptyToNull(query.categoryId),
    merchantId: emptyToNull(query.merchantId),
    itemCategoryId: emptyToNull(query.itemCategoryId),
  };

  // Home currency labels the whole (converted) report; get_user_profile is SECURITY DEFINER
  // by cognito_sub, so this read stands outside the tenant transaction (as the inflation card does).
  const profile = await new AppUserRepositoryAdapter(db).getProfile(user.cognitoSub);
  const homeCurrency = profile?.currency ?? null;
  const isPremium = PREMIUM_ROLES.has(user.role);

  const service = new SpendReportService(new SpendReportQueryAdapter(db, homeCurrency));
  try {
    const report = await withTenantTx(db, user.id, () => service.report(params, isPremium, homeCurrency));
    return json(200, report);
  } catch (err) {
    if (err instanceof PremiumRequiredError) return json(403, { message: err.message });
    if (err instanceof InvalidSpendReportQueryError) return json(400, { message: err.message });
    throw err;
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}
