import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { RDS_CA_BUNDLE } from './rdsCaBundle';

interface DbSecret {
  username: string;
  password: string;
  dbname?: string;
}

let pool: Pool | null = null;

// Fail-closed RLS guard. Tenant isolation is enforced by RLS + SET LOCAL on a
// non-owner role; a role that bypasses RLS (table owner without FORCE, superuser,
// or BYPASSRLS) silently returns cross-tenant rows. Refuse to serve on such a role
// so the misconfiguration is loud instead of a silent data leak (invariant #1).
export class RlsBypassError extends Error {
  constructor(role: string, reason: string) {
    super(`Runtime DB role "${role}" can bypass RLS (${reason}); refusing to serve to prevent cross-tenant leakage.`);
    this.name = 'RlsBypassError';
  }
}

export async function assertRuntimeRoleCannotBypassRls(runtimePool: Pick<Pool, 'query'>): Promise<void> {
  const { rows } = await runtimePool.query<{ role: string; attr_bypass: boolean; owner_bypass: boolean }>(
    `SELECT current_user AS role,
            COALESCE((SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user), false) AS attr_bypass,
            EXISTS (
              SELECT 1 FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind = 'r'
                AND c.relrowsecurity AND NOT c.relforcerowsecurity
                AND pg_get_userbyid(c.relowner) = current_user
            ) AS owner_bypass`,
  );
  const r = rows[0];
  if (r.attr_bypass) throw new RlsBypassError(r.role, 'role is SUPERUSER or has BYPASSRLS');
  if (r.owner_bypass) throw new RlsBypassError(r.role, 'role owns RLS tables that are not FORCE ROW LEVEL SECURITY');
}

// `maxConnections` stays 1 for every handler that does all its work on one transaction. Only the
// ingestion worker raises it (to 2): its progress writes (fix 07/01) need a second connection
// while the pipeline's long transaction still holds the first. Raising this widens the
// per-container share of the db.t3.micro budget documented in backend CLAUDE.md — check the
// arithmetic there before touching it.
export async function buildPool(
  secretArn: string,
  host: string,
  port: string,
  statementTimeoutMs = 5000,
  maxConnections = 1,
): Promise<Pool> {
  if (pool) return pool;

  // Local dev (Docker Postgres) has no Secrets Manager and no TLS —
  // connect via a DATABASE_URL with SSL disabled.
  // The app runtime uses APP_DATABASE_URL (a non-owner, non-superuser role) so RLS
  // is actually enforced — the owner/superuser DATABASE_URL bypasses RLS and is
  // reserved for migrations/seeds. Falls back to DATABASE_URL when unset.
  // Unlike AWS (one connection per isolated Lambda container), the local harness
  // runs the API server and the ingestion poller in a single process sharing this
  // pool. A long Bedrock-bound ingestion transaction would starve API requests off
  // a max:1 pool and trip connectionTimeoutMillis, so allow a few connections here.
  const localUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
  if (process.env.STAGE === 'local' && localUrl) {
    pool = new Pool({
      connectionString: localUrl,
      max: 10,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 5000,
      options: `--statement_timeout=${statementTimeoutMs}`,
      ssl: false,
    });
    await assertRuntimeRoleCannotBypassRls(pool);
    return pool;
  }

  const sm = new SecretsManagerClient({});
  const response = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secret: DbSecret = JSON.parse(response.SecretString ?? '{}');

  const isLocal = process.env.STAGE === 'local' || host === 'localhost' || host === '127.0.0.1';

  pool = new Pool({
    host,
    port: parseInt(port, 10),
    database: secret.dbname ?? 'wobblio',
    user: secret.username,
    password: secret.password,
    max: maxConnections,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 5000,
    options: `--statement_timeout=${statementTimeoutMs}`,
    // Verify the RDS server cert against the AWS CA bundle — never disable verification
    // (rejectUnauthorized:false allows MITM). Local Postgres has no TLS.
    ssl: isLocal ? undefined : { ca: RDS_CA_BUNDLE, rejectUnauthorized: true },
  });

  await assertRuntimeRoleCannotBypassRls(pool);
  return pool;
}
