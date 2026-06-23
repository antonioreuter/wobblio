import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { json } from './shared';
import { handleAdminWaitlistRoute } from './adminWaitlistRoutes';
import { handleAdminDlqRoute } from './adminDlqRoutes';
import { handleAdminConfigRoute } from './adminConfigRoutes';
import { handleAdminModelRoute } from './adminModelRoutes';
import { handleAdminCurationRoute } from './adminCurationRoutes';
import { handleAdminAnalyticsRoute } from './adminAnalyticsRoutes';

// Admin-console backend entry. The FIRST line is the server-side ADMIN guard —
// independent of the edge middleware in Source/admin, both must pass (admin-console
// 00). role is read from the DB-resolved app_user; it is never client-writable
// (root invariant #5) and no admin endpoint mutates it.
export async function handleAdminRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (user.role !== 'ADMIN') {
    log.warn('non-admin hit admin route', { userId: user.id, role: user.role, path });
    return json(403, { message: 'Forbidden' });
  }

  if (path.startsWith('/admin/waitlist')) return handleAdminWaitlistRoute(db, user, path, method, event, log);
  if (path.startsWith('/admin/dlq')) return handleAdminDlqRoute(db, user, path, method, event, log);
  if (path.startsWith('/admin/config')) return handleAdminConfigRoute(db, user, path, method, event, log);
  if (path.startsWith('/admin/models')) return handleAdminModelRoute(db, user, path, method, event, log);
  if (path.startsWith('/admin/curation')) return handleAdminCurationRoute(db, user, path, method, event, log);
  if (path === '/admin/kpis' || path === '/admin/ai-spend') return handleAdminAnalyticsRoute(db, path, method, event);

  return json(404, { message: 'Not Found' });
}
