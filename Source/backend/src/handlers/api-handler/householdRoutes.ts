import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { HouseholdRepositoryAdapter } from '@infrastructure/adapters/households/HouseholdRepositoryAdapter';
import { HouseholdInviteRepositoryAdapter } from '@infrastructure/adapters/households/HouseholdInviteRepositoryAdapter';
import { SecureTokenAdapter } from '@infrastructure/adapters/security/SecureTokenAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { QuotaRepositoryAdapter } from '@infrastructure/adapters/quota/QuotaRepositoryAdapter';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { HouseholdService } from '@core/services/households/HouseholdService';
import { HouseholdInviteService } from '@core/services/households/HouseholdInviteService';
import { QuotaService } from '@core/services/quota/QuotaService';
import {
  PremiumRequiredError,
  AlreadyOwnsHouseholdError,
  InvalidHouseholdError,
  HouseholdNotFoundError,
  NotHouseholdOwnerError,
  OwnerCannotLeaveError,
  HouseholdFullError,
  InvalidInviteError,
} from '@core/domain/errors';
import { REGION, json, parseJsonBody, withTenantTx } from './shared';

export async function handleHouseholdsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (method === 'POST' && path === '/households') return createHousehold(db, user, event, log);

  const acceptMatch = path.match(/^\/households\/accept-invite\/([^/]+)$/);
  if (method === 'POST' && acceptMatch) return acceptInvite(db, user, acceptMatch[1], log);

  const inviteMatch = path.match(/^\/households\/([^/]+)\/invite$/);
  if (method === 'POST' && inviteMatch) return createInvite(db, user, inviteMatch[1], log);

  const revokeMatch = path.match(/^\/households\/([^/]+)\/invites\/([^/]+)$/);
  if (method === 'DELETE' && revokeMatch) return revokeInvite(db, user, revokeMatch[1], revokeMatch[2], log);

  const memberMatch = path.match(/^\/households\/([^/]+)\/members\/([^/]+)$/);
  if (method === 'DELETE' && memberMatch) return removeMember(db, user, memberMatch[1], memberMatch[2], log);

  const leaveMatch = path.match(/^\/households\/([^/]+)\/leave$/);
  if (method === 'POST' && leaveMatch) return leaveHousehold(db, user, leaveMatch[1], log);

  const detailMatch = path.match(/^\/households\/([^/]+)$/);
  if (method === 'GET' && detailMatch) return getHousehold(db, user, detailMatch[1]);
  if (method === 'DELETE' && detailMatch) return disbandHousehold(db, user, detailMatch[1], log);

  return json(404, { message: 'Not Found' });
}

function householdService(db: PoolClient): HouseholdService {
  return new HouseholdService(new HouseholdRepositoryAdapter(db));
}

function inviteService(db: PoolClient): HouseholdInviteService {
  return new HouseholdInviteService(
    new HouseholdRepositoryAdapter(db),
    new HouseholdInviteRepositoryAdapter(db),
    new SecureTokenAdapter(),
    buildKmsEncryption(REGION),
  );
}

async function guard(fn: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PremiumRequiredError) return json(403, { message: err.message });
    if (err instanceof NotHouseholdOwnerError) return json(403, { message: err.message });
    if (err instanceof HouseholdNotFoundError) return json(404, { message: err.message });
    if (err instanceof AlreadyOwnsHouseholdError) return json(409, { message: err.message });
    if (err instanceof OwnerCannotLeaveError) return json(409, { message: err.message });
    if (err instanceof HouseholdFullError) return json(409, { message: err.message });
    if (err instanceof InvalidHouseholdError) return json(400, { message: err.message });
    if (err instanceof InvalidInviteError) return json(400, { message: err.message });
    throw err;
  }
}

function createHousehold(
  db: PoolClient,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const name = typeof body.name === 'string' ? body.name : '';
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const household = await householdService(db).create(user.id, user.role, name);
      log.info('household created', { userId: user.id, householdId: household.id });
      return json(201, household);
    }),
  );
}

function getHousehold(db: PoolClient, user: AppUser, householdId: string): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const detail = await householdService(db).getDetail(householdId);
      const quota = new QuotaService(new QuotaRepositoryAdapter(db));
      const used = await quota.getUsed(householdId, 'HOUSEHOLD_UPLOADS', new Date());
      const cap = await new SsmUploadQuotaAdapter(REGION).getHouseholdUploadsCap();
      return json(200, { ...detail, pool: { used, cap, remaining: Math.max(0, cap - used) } });
    }),
  );
}

function disbandHousehold(
  db: PoolClient,
  user: AppUser,
  householdId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await householdService(db).disband(user.id, householdId);
      log.info('household disbanded', { userId: user.id, householdId });
      return json(204, {});
    }),
  );
}

function createInvite(
  db: PoolClient,
  user: AppUser,
  householdId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const invite = await inviteService(db).createInvite(user.id, householdId);
      const base = process.env.WEB_APP_URL ?? '';
      log.info('household invite created', { userId: user.id, householdId, inviteId: invite.inviteId });
      return json(201, {
        inviteId: invite.inviteId,
        token: invite.token,
        inviteUrl: `${base}/household/join?token=${invite.token}`,
        expiresAt: invite.expiresAt,
      });
    }),
  );
}

function revokeInvite(
  db: PoolClient,
  user: AppUser,
  householdId: string,
  inviteId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await inviteService(db).revokeInvite(user.id, householdId, inviteId);
      log.info('household invite revoked', { userId: user.id, householdId, inviteId });
      return json(204, {});
    }),
  );
}

function acceptInvite(
  db: PoolClient,
  user: AppUser,
  token: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const household = await inviteService(db).acceptInvite(user.id, token);
      log.info('household invite accepted', { userId: user.id, householdId: household.id });
      return json(200, household);
    }),
  );
}

function removeMember(
  db: PoolClient,
  user: AppUser,
  householdId: string,
  memberId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await householdService(db).removeMember(user.id, householdId, memberId);
      log.info('household member removed', { userId: user.id, householdId, memberId });
      return json(204, {});
    }),
  );
}

function leaveHousehold(
  db: PoolClient,
  user: AppUser,
  householdId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await householdService(db).leave(user.id, householdId);
      log.info('household left', { userId: user.id, householdId });
      return json(204, {});
    }),
  );
}
