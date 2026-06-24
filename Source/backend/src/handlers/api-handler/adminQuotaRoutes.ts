import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { QuotaRepositoryAdapter } from '@infrastructure/adapters/quota/QuotaRepositoryAdapter';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { QuotaService } from '@core/services/quota/QuotaService';
import { InvalidAdminInputError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

interface UserSearchResult {
  id: string;
  email: string;
  role: string;
  quotaUsed: number;
  quotaCap: number;
}

export async function handleAdminQuotaRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && path === '/admin/users') {
    return searchUsers(db, event);
  }

  const idMatch = path.match(/^\/admin\/users\/([^/]+)\/quota-adjustment$/);
  if (method === 'POST' && idMatch) {
    return adjustQuota(db, user, idMatch[1], event, log);
  }

  return json(404, { message: 'Not Found' });
}

async function searchUsers(db: PoolClient, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const email = (event.queryStringParameters?.email ?? '').trim();
  if (!email) return json(400, { message: 'email query param required' });

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStart(today);

  const userResult = await db.query<{ id: string; email: string; role: string }>(
    `SELECT id, email, role FROM app_user
     WHERE email ILIKE $1
     ORDER BY email
     LIMIT 20`,
    [`%${email}%`],
  );

  const quotaRepo = new QuotaRepositoryAdapter(db);
  const quotaProvider = new SsmUploadQuotaAdapter(REGION);
  const results: UserSearchResult[] = [];

  for (const row of userResult.rows) {
    const quotaUsed = await quotaRepo.getUsed(row.id, 'UPLOADS', weekStart);
    const quotaCap = await quotaProvider.getPersonalUploadsCap(row.role as any);
    results.push({
      id: row.id,
      email: row.email,
      role: row.role,
      quotaUsed,
      quotaCap,
    });
  }

  return json(200, { users: results });
}

async function adjustQuota(
  db: PoolClient,
  adminUser: AppUser,
  targetUserId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const delta = Number(body.delta ?? NaN);

  if (!Number.isInteger(delta)) return json(400, { message: 'delta must be an integer' });

  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = getWeekStart(today);

    // Get user info for role
    const userResult = await db.query<{ email: string; role: string }>(
      `SELECT email, role FROM app_user WHERE id = $1`,
      [targetUserId],
    );
    if (!userResult.rows[0]) return json(404, { message: 'User not found' });
    const targetUser = userResult.rows[0];

    // Perform adjustment
    const quotaRepo = new QuotaRepositoryAdapter(db);
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        await quotaRepo.increment(targetUserId, 'UPLOADS', weekStart);
      }
    } else if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) {
        await quotaRepo.decrement(targetUserId, 'UPLOADS', weekStart);
      }
    }

    // Get new quota state
    const quotaUsed = await quotaRepo.getUsed(targetUserId, 'UPLOADS', weekStart);
    const quotaProvider = new SsmUploadQuotaAdapter(REGION);
    const quotaCap = await quotaProvider.getPersonalUploadsCap(targetUser.role as any);

    // Log audit trail
    const auditLog = new AdminAuditLogAdapter(db);
    await auditLog.log({
      actor_id: adminUser.id,
      action: 'quota_adjustment',
      target_user_id: targetUserId,
      delta,
      new_value: quotaUsed,
      cap: quotaCap,
    });

    log.info('admin quota adjustment', {
      adminId: adminUser.id,
      targetUserId,
      targetEmail: targetUser.email,
      delta,
      newUsed: quotaUsed,
    });

    return json(200, { used: quotaUsed, cap: quotaCap });
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}

function getWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}
