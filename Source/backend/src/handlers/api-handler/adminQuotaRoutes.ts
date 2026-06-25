import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser, UserRole } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { weekStart } from '@core/domain/week';
import { REGION, json, parseJsonBody } from './shared';

interface UserSearchResult {
  id: string;
  email: string;
  role: string;
  quotaUsed: number;
  quotaCap: number | null; // null = unlimited (TESTER/ADMIN); JSON cannot carry Infinity
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

  const roleMatch = path.match(/^\/admin\/users\/([^/]+)\/role$/);
  if (method === 'PUT' && roleMatch) {
    return changeRole(db, user, roleMatch[1], event, log);
  }

  return json(404, { message: 'Not Found' });
}

const ROLES: readonly UserRole[] = ['STANDARD', 'PREMIUM', 'TESTER', 'ADMIN'];

// Operator role change (invariant #5 deviation, see adminRoutes.ts). app_user RLS
// blocks a cross-tenant UPDATE, so admin_set_user_role runs as owner; the action
// is audited role.change with the old → new role.
async function changeRole(
  db: PoolClient,
  adminUser: AppUser,
  targetUserId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const nextRole = String(body.role ?? '') as UserRole;
  if (!ROLES.includes(nextRole)) return json(400, { message: `role must be one of ${ROLES.join(', ')}` });

  const userResult = await db.query<{ email: string; role: string }>(
    `SELECT email, role FROM admin_get_user($1)`,
    [targetUserId],
  );
  if (!userResult.rows[0]) return json(404, { message: 'User not found' });
  const targetUser = userResult.rows[0];

  await db.query(`SELECT admin_set_user_role($1, $2)`, [targetUserId, nextRole]);

  await new AdminAuditLogAdapter(db).record({
    actorUserId: adminUser.id,
    actorEmail: adminUser.email,
    action: 'role.change',
    target: targetUserId,
    before: targetUser.role,
    after: nextRole,
  });

  log.info('admin role change', {
    adminId: adminUser.id,
    targetUserId,
    targetEmail: targetUser.email,
    before: targetUser.role,
    after: nextRole,
  });

  return json(200, { id: targetUserId, role: nextRole });
}

// Caps may be Infinity for TESTER/ADMIN; JSON.stringify turns Infinity into null,
// so normalise to an explicit null the client renders as "∞".
function toJsonCap(cap: number): number | null {
  return Number.isFinite(cap) ? cap : null;
}

async function searchUsers(db: PoolClient, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const email = (event.queryStringParameters?.email ?? '').trim();
  if (!email) return json(400, { message: 'email query param required' });

  const week = weekStart(new Date().toISOString().slice(0, 10));

  // SECURITY DEFINER helper — app_user RLS would otherwise scope this to the admin.
  const userResult = await db.query<{ id: string; email: string; role: string }>(
    `SELECT id, email, role FROM admin_search_users_by_email($1)`,
    [email],
  );
  if (userResult.rows.length === 0) return json(200, { users: [] });

  // One cross-tenant read for the whole page (the SECURITY DEFINER helper bypasses
  // quota_counter RLS — the connection's tenant context is the admin, not the targets).
  const ids = userResult.rows.map((row) => row.id);
  const usedResult = await db.query<{ user_id: string; used: number }>(
    `SELECT user_id, used FROM admin_personal_upload_used($1, $2)`,
    [ids, week],
  );
  const usedById = new Map(usedResult.rows.map((r) => [r.user_id, r.used]));

  const quotaProvider = new SsmUploadQuotaAdapter(REGION);
  const results: UserSearchResult[] = [];
  for (const row of userResult.rows) {
    const cap = await quotaProvider.getPersonalUploadsCap(row.role as UserRole);
    results.push({
      id: row.id,
      email: row.email,
      role: row.role,
      quotaUsed: usedById.get(row.id) ?? 0,
      quotaCap: toJsonCap(cap),
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
  // delta = scans GRANTED to the user: positive frees scans (lowers used), negative consumes.
  const granted = Number(body.delta ?? NaN);
  if (!Number.isInteger(granted)) return json(400, { message: 'delta must be an integer' });

  const week = weekStart(new Date().toISOString().slice(0, 10));

  const userResult = await db.query<{ email: string; role: string }>(
    `SELECT email, role FROM admin_get_user($1)`,
    [targetUserId],
  );
  if (!userResult.rows[0]) return json(404, { message: 'User not found' });
  const targetUser = userResult.rows[0];

  const beforeResult = await db.query<{ used: number }>(
    `SELECT used FROM admin_personal_upload_used($1, $2)`,
    [[targetUserId], week],
  );
  const usedBefore = beforeResult.rows[0]?.used ?? 0;

  // SECURITY DEFINER helper applies the clamped grant and returns the new used count,
  // bypassing quota_counter RLS for this cross-tenant write.
  const adjustResult = await db.query<{ used: number }>(
    `SELECT admin_grant_personal_uploads($1, $2, $3) AS used`,
    [targetUserId, week, granted],
  );
  const quotaUsed = adjustResult.rows[0].used;

  const quotaCap = toJsonCap(await new SsmUploadQuotaAdapter(REGION).getPersonalUploadsCap(targetUser.role as UserRole));

  await new AdminAuditLogAdapter(db).record({
    actorUserId: adminUser.id,
    actorEmail: adminUser.email,
    action: 'quota.adjust',
    target: targetUserId,
    before: usedBefore,
    after: quotaUsed,
  });

  log.info('admin quota adjustment', {
    adminId: adminUser.id,
    targetUserId,
    targetEmail: targetUser.email,
    granted,
    newUsed: quotaUsed,
  });

  return json(200, { used: quotaUsed, cap: quotaCap });
}
