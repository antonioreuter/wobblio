import { describe, it, expect, vi } from 'vitest';
import type { PoolClient } from 'pg';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handleAdminRoute } from '@handlers/api-handler/adminRoutes';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LambdaLogger;
const db = {} as PoolClient;
const event = { body: null } as unknown as APIGatewayProxyEvent;

const userWithRole = (role: AppUser['role']): AppUser =>
  ({ id: 'u-1', email: 'u@wobblio.nl', role } as AppUser);

describe('handleAdminRoute server-side ADMIN gate', () => {
  it('denies a non-admin hitting the feature toggle with 403 (no handler reached)', async () => {
    const res = await handleAdminRoute(
      db,
      userWithRole('STANDARD'),
      '/admin/features/toggle',
      'POST',
      event,
      log,
    );

    expect(res.statusCode).toBe(403);
  });
});
