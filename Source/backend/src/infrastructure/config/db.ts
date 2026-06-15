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
  // connect via DATABASE_URL with SSL disabled.
  if (process.env.STAGE === 'local' && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
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
