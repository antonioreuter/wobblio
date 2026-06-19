import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface DbSecret {
  username: string;
  password: string;
  dbname?: string;
}

let pool: Pool | null = null;

export async function buildPool(
  secretArn: string,
  host: string,
  port: string,
  statementTimeoutMs = 5000,
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
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 5000,
    options: `--statement_timeout=${statementTimeoutMs}`,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

  return pool;
}
