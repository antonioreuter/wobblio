import * as fs from 'fs';
import * as path from 'path';

const backendDir = path.resolve(__dirname, '../../../../backend');

function requireFromBackend(moduleName: string): any {
  try {
    const resolvedPath = require.resolve(moduleName, { paths: [backendDir] });
    return require(resolvedPath);
  } catch (err: any) {
    console.error(`❌ Could not resolve module "${moduleName}" from backend directory:`, err.message);
    process.exit(1);
  }
}

const { Client } = requireFromBackend('pg');
const { SSMClient, GetParameterCommand } = requireFromBackend('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = requireFromBackend('@aws-sdk/client-secrets-manager');

async function resolveSsm(param: string): Promise<string> {
  const client = new SSMClient({});
  const res = await client.send(new GetParameterCommand({ Name: param }));
  return res.Parameter?.Value || '';
}

async function fetchSecret(secretArn: string): Promise<any> {
  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return JSON.parse(res.SecretString!);
}

async function getDbClient(): Promise<any> {
  let host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'invoice_comparator_dev';
  let user = process.env.DB_USER || 'dev_user';
  let password = process.env.DB_PASSWORD || 'dev_password';
  const secretArn = process.env.DB_SECRET_ARN;
  const dbSsl = process.env.DB_SSL === 'true';

  if (host.startsWith('/')) {
    host = await resolveSsm(host);
  }

  if (secretArn && (secretArn.startsWith('/') || secretArn.startsWith('arn:'))) {
    let actualArn = secretArn;
    if (secretArn.startsWith('/')) {
      actualArn = await resolveSsm(secretArn);
    }
    const creds = await fetchSecret(actualArn);
    user = creds.username;
    password = creds.password;
  }

  return new Client({
    host,
    port: parseInt(port, 10),
    database,
    user,
    password,
    ssl: dbSsl ? { rejectUnauthorized: false } : false,
  });
}

async function runAudit() {
  console.log('🛡️  Starting Database Design & Security Audit...\n');

  let client: any;
  try {
    client = await getDbClient();
    await client.connect();
    console.log(`Connected to DB: ${client.database}\n`);
  } catch (err: any) {
    console.error('❌ Failed to connect to the database:', err.message);
    process.exit(1);
  }

  let auditFailed = false;

  try {
    // 1. Audit Row-Level Security (RLS) Status
    console.log('--- Checking Row-Level Security (RLS) Status ---');
    const rlsRes = await client.query(`
      SELECT relname as table_name, relrowsecurity as rls_enabled 
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
        AND c.relname != 'pgmigrations'
      ORDER BY table_name;
    `);

    let rlsIssues = 0;
    for (const row of rlsRes.rows) {
      if (row.rls_enabled) {
        console.log(`   ✅ RLS is enabled on "${row.table_name}"`);
      } else {
        console.warn(`   ❌ RLS is DISABLED on "${row.table_name}"!`);
        rlsIssues++;
      }
    }
    if (rlsIssues === 0) {
      console.log('✅ RLS compliance check passed: all tables secured.\n');
    } else {
      console.warn(`⚠️  RLS compliance issues found: ${rlsIssues} table(s) lack Row-Level Security.\n`);
      auditFailed = true;
    }

    // 2. Audit Primary Key Constraints
    console.log('--- Checking Primary Key Constraints ---');
    const pkRes = await client.query(`
      SELECT tablename as table_name 
      FROM pg_tables t
      WHERE schemaname = 'public'
        AND tablename != 'pgmigrations'
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class cl ON cl.oid = c.conrelid
          JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          WHERE ns.nspname = 'public' AND cl.relname = t.tablename AND c.contype = 'p'
        )
      ORDER BY table_name;
    `);

    if (pkRes.rows.length === 0) {
      console.log('   ✅ All tables have a Primary Key constraint.\n');
    } else {
      for (const row of pkRes.rows) {
        console.error(`   ❌ Table "${row.table_name}" is missing a Primary Key constraint!`);
      }
      console.warn(`⚠️  Primary Key check failed: ${pkRes.rows.length} table(s) are missing primary keys.\n`);
      auditFailed = true;
    }

    // 3. Audit Foreign Key Indexes
    console.log('--- Checking Foreign Key Indexing ---');
    const fkRes = await client.query(`
      SELECT
          con.conname AS constraint_name,
          conrel.relname AS table_name,
          att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class conrel ON conrel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = conrel.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE ns.nspname = 'public'
        AND con.contype = 'f'
        AND ARRAY_LENGTH(con.conkey, 1) = 1
        AND NOT EXISTS (
            SELECT 1
            FROM pg_index ind
            JOIN pg_class irel ON irel.oid = ind.indexrelid
            WHERE ind.indrelid = con.conrelid
              AND ind.indkey[0] = con.conkey[1]
        )
      ORDER BY table_name, column_name;
    `);

    if (fkRes.rows.length === 0) {
      console.log('   ✅ All foreign keys have a supporting leading-column index.\n');
    } else {
      for (const row of fkRes.rows) {
        console.error(`   ❌ Foreign key "${row.constraint_name}" on table "${row.table_name}" (${row.column_name}) is NOT indexed!`);
      }
      console.warn(`⚠️  Foreign Key Indexing check failed: ${fkRes.rows.length} unindexed foreign key column(s) found.\n`);
      auditFailed = true;
    }

    console.log('=======================================');
    if (auditFailed) {
      console.error('❌ Database schema and security audit failed!');
      process.exit(1);
    } else {
      console.log('🎉 All Database schema and security audits passed successfully!');
      process.exit(0);
    }
    console.log('=======================================');
  } catch (error) {
    console.error('❌ ERROR executing design and security audit:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAudit();
