import type { APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { NotificationRepositoryAdapter } from '@infrastructure/adapters/notifications/NotificationRepositoryAdapter';
import { NotificationService } from '@core/services/notifications/NotificationService';
import { json, withTenantTx } from './shared';

export async function handleNotificationsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && path === '/notifications') {
    return withTenantTx(db, user.id, async () =>
      json(200, { notifications: await notificationService(db).list() }),
    );
  }

  const readMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (method === 'POST' && readMatch) {
    return withTenantTx(db, user.id, async () => {
      await notificationService(db).markRead(readMatch[1]);
      return json(204, {});
    });
  }

  return json(404, { message: 'Not Found' });
}

function notificationService(db: PoolClient): NotificationService {
  return new NotificationService(new NotificationRepositoryAdapter(db));
}
