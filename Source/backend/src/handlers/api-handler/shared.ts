import type { APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';

export const REGION = process.env.AWS_REGION ?? 'eu-west-1';

// 204/205/304 must carry no body per HTTP; everything else serializes JSON.
const NO_BODY_STATUSES = new Set([204, 205, 304]);

export const json = (statusCode: number, body: object): APIGatewayProxyResult => {
  if (NO_BODY_STATUSES.has(statusCode)) return { statusCode, headers: {}, body: '' };
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
};

export function parseJsonBody(body: string | null): Record<string, unknown> {
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Runs fn inside a transaction with the RLS tenant context set first, so every
// query in fn shares one connection and one tenant scope (invariant #1).
export async function withTenantTx<T>(db: PoolClient, tenantId: string, fn: () => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  try {
    await new TenantContextAdapter(db).setTenantId(tenantId);
    const result = await fn();
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}
