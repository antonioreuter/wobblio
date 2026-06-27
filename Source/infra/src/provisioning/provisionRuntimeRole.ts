import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Reproducible, idempotent provisioning of the non-owner application DB role + secret
// rotation — the automated equivalent of provision-runtime-role.sql / README.md, so a
// torn-down environment can be rebuilt with one command instead of a manual runbook.
//
//   STAGE=dev CONFIRM_PROVISION=wobblio_dev npm run provision:runtime-role
//
// WHY: the app must NOT connect as the table owner (owner is exempt from RLS unless
// FORCE — which we don't use). This creates a NOSUPERUSER/NOBYPASSRLS non-owner role,
// grants it least-privilege DML, and points the app secret at it. Uses the RDS master
// (shared/db/master) because the owner role lacks CREATEROLE.

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const MASTER_SECRET = 'shared/db/master';
// Verify the RDS server cert against the AWS CA bundle — never disable verification.
const RDS_CA = readFileSync(join(__dirname, 'rds-ca-eu-west-1.pem'), 'utf8');

interface StagePlan {
  dbname: string;
  role: string;
  owner: string;
  appSecretId: string;
}

// Stage → role/owner/db/secret. Mirrors config/environment.ts dbSecretParam naming.
const PLANS: Record<string, StagePlan> = {
  dev: { dbname: 'wobblio_dev', role: 'wobblio_dev_runtime', owner: 'wobblio_dev_app', appSecretId: 'shared/db/wobblio_dev' },
  prod: { dbname: 'wobblio', role: 'wobblio_runtime', owner: 'wobblio_app', appSecretId: 'shared/db/wobblio' },
};

interface DbSecret { username: string; password: string; host: string; port: string | number; dbname?: string }

async function getSecret(sm: SecretsManagerClient, id: string): Promise<DbSecret> {
  const res = await sm.send(new GetSecretValueCommand({ SecretId: id }));
  return JSON.parse(res.SecretString ?? '{}') as DbSecret;
}

// Identifiers come from the fixed PLANS map and the password is hex — both controlled,
// not user input — so interpolation here cannot be injected. DDL can't bind these.
function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return `"${name}"`;
}

async function provision(): Promise<void> {
  const stage = process.env.STAGE ?? 'dev';
  const plan = PLANS[stage];
  if (!plan) throw new Error(`unknown STAGE "${stage}" (expected dev|prod)`);
  if (process.env.CONFIRM_PROVISION !== plan.dbname) {
    throw new Error(`refusing: set CONFIRM_PROVISION=${plan.dbname} to provision ${stage}`);
  }

  const sm = new SecretsManagerClient({ region: REGION });
  const master = await getSecret(sm, MASTER_SECRET);
  const password = randomBytes(24).toString('hex');
  const role = quoteIdent(plan.role);
  const owner = quoteIdent(plan.owner);
  const db = quoteIdent(plan.dbname);

  const client = new Client({
    host: master.host,
    port: Number(master.port),
    database: plan.dbname,
    user: master.username,
    password: master.password,
    ssl: { ca: RDS_CA, rejectUnauthorized: true },
  });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [plan.role]);
    const attrs = `LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`;
    await client.query(exists.rowCount ? `ALTER ROLE ${role} ${attrs}` : `CREATE ROLE ${role} ${attrs}`);

    await client.query(`GRANT CONNECT ON DATABASE ${db} TO ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${role}`);

    // Future owner-created objects (new migrations) auto-grant to the runtime role.
    await client.query(`GRANT ${owner} TO CURRENT_USER`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`);

    const check = await client.query(
      'SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = $1',
      [plan.role],
    );
    const r = check.rows[0];
    if (r.rolsuper || r.rolbypassrls || r.rolcreaterole) {
      throw new Error(`role ${plan.role} is over-privileged: ${JSON.stringify(r)}`);
    }
  } finally {
    await client.end();
  }

  await sm.send(new PutSecretValueCommand({
    SecretId: plan.appSecretId,
    SecretString: JSON.stringify({
      username: plan.role,
      password,
      host: master.host,
      port: String(master.port),
      dbname: plan.dbname,
    }),
  }));

  console.log(`Provisioned non-owner role ${plan.role} and rotated ${plan.appSecretId}. Redeploy the backend to pick it up.`);
}

provision().catch(err => {
  console.error('Provisioning failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
