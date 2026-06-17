import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { BudgetRepositoryAdapter } from '@infrastructure/adapters/budgets/BudgetRepositoryAdapter';
import { HouseholdRepositoryAdapter } from '@infrastructure/adapters/households/HouseholdRepositoryAdapter';
import { BudgetService, type NewBudget } from '@core/services/budgets/BudgetService';
import type { BudgetPatch } from '@core/ports/budgets/IBudgetRepository';
import type { BudgetScope, BudgetPeriod } from '@core/domain/budget';
import {
  PremiumRequiredError,
  InvalidBudgetError,
  BudgetLimitError,
  BudgetNotFoundError,
  NotHouseholdOwnerError,
} from '@core/domain/errors';
import { json, parseJsonBody, withTenantTx } from './shared';

export async function handleBudgetsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (method === 'POST' && path === '/budgets') return createBudget(db, user, event, log);
  if (method === 'GET' && path === '/budgets') return listBudgets(db, user);

  const idMatch = path.match(/^\/budgets\/([^/]+)$/);
  if (method === 'PATCH' && idMatch) return updateBudget(db, user, idMatch[1], event, log);
  if (method === 'DELETE' && idMatch) return deleteBudget(db, user, idMatch[1], log);

  return json(404, { message: 'Not Found' });
}

function service(db: PoolClient): BudgetService {
  return new BudgetService(new BudgetRepositoryAdapter(db), new HouseholdRepositoryAdapter(db));
}

async function guard(fn: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PremiumRequiredError) return json(403, { message: err.message });
    if (err instanceof NotHouseholdOwnerError) return json(403, { message: err.message });
    if (err instanceof InvalidBudgetError) return json(400, { message: err.message });
    if (err instanceof BudgetLimitError) return json(409, { message: err.message });
    if (err instanceof BudgetNotFoundError) return json(404, { message: err.message });
    throw err;
  }
}

function createBudget(
  db: PoolClient,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const input = parseNewBudget(parseJsonBody(event.body));
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const budget = await service(db).create(user.id, user.role, input);
      log.info('budget created', { userId: user.id, budgetId: budget.id });
      return json(201, budget);
    }),
  );
}

function listBudgets(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => json(200, { budgets: await service(db).list() })),
  );
}

function updateBudget(
  db: PoolClient,
  user: AppUser,
  budgetId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const patch = parsePatch(parseJsonBody(event.body));
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).update(budgetId, patch);
      log.info('budget updated', { userId: user.id, budgetId });
      return json(200, { updated: true });
    }),
  );
}

function deleteBudget(
  db: PoolClient,
  user: AppUser,
  budgetId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).remove(budgetId);
      log.info('budget deleted', { userId: user.id, budgetId });
      return json(204, {});
    }),
  );
}

function parseNewBudget(body: Record<string, unknown>): NewBudget {
  return {
    scope: String(body.scope ?? '') as BudgetScope,
    categoryId: typeof body.categoryId === 'string' ? body.categoryId : null,
    memberUserId: typeof body.memberUserId === 'string' ? body.memberUserId : null,
    amount: typeof body.amount === 'number' ? body.amount : Number(body.amount),
    period: String(body.period ?? '') as BudgetPeriod,
  };
}

function parsePatch(body: Record<string, unknown>): BudgetPatch {
  const patch: BudgetPatch = {};
  if (body.amount !== undefined) patch.amount = Number(body.amount);
  if (typeof body.period === 'string') patch.period = body.period as BudgetPeriod;
  return patch;
}
