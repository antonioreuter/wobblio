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

async function runCheck() {
  console.log('📋 Starting Database Migrations Check...\n');

  console.log('--- Checking Local Migration Files ---');
  const migrationsDir = path.join(__dirname, '../../../../infra/db/migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migration directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
    .sort();

  console.log(`Found ${migrationFiles.length} local migration file(s).`);

  let invalidFilesCount = 0;
  const localMigrations: { name: string; hasUp: boolean; hasDown: boolean }[] = [];

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const hasUp = content.includes('export async function up') || content.includes('exports.up');
    const hasDown = content.includes('export async function down') || content.includes('exports.down');
    
    const migrationName = path.parse(file).name;
    localMigrations.push({ name: migrationName, hasUp, hasDown });

    if (!hasUp || !hasDown) {
      console.warn(`⚠️  Warning in migration file "${file}":`);
      if (!hasUp) console.warn('   - Missing "up" export.');
      if (!hasDown) console.warn('   - Missing "down" export (Rollbacks will fail).');
      invalidFilesCount++;
    }
  }

  if (invalidFilesCount === 0) {
    console.log('✅ All local migration files export "up" and "down" functions.\n');
  } else {
    console.log(`⚠️  Found issues in ${invalidFilesCount} migration file(s).\n`);
  }

  console.log('--- Checking Database Execution History ---');
  let client: any;
  try {
    client = await getDbClient();
    await client.connect();
    console.log(`Connected to DB: ${client.database}\n`);
  } catch (err: any) {
    console.error('❌ Failed to connect to the database:', err.message);
    process.exit(1);
  }

  try {
    let appliedMigrations: string[] = [];
    
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'pgmigrations'
      );
    `);
    const pgMigrationsTableExists = tableCheck.rows[0].exists;

    if (!pgMigrationsTableExists) {
      console.log('⚠️  "pgmigrations" table does not exist. No migrations have been run yet.\n');
    } else {
      const res = await client.query('SELECT name, run_on FROM pgmigrations ORDER BY run_on ASC;');
      appliedMigrations = res.rows.map((row: any) => row.name);
      
      if (appliedMigrations.length > 0) {
        console.log(`Latest executed migration: "${appliedMigrations[appliedMigrations.length - 1]}"`);
        console.log(`Applied migrations count: ${appliedMigrations.length} / Total: ${localMigrations.length}`);
      } else {
        console.log('No migrations recorded in pgmigrations.');
      }
    }

    const pending = localMigrations.filter(m => !appliedMigrations.includes(m.name));
    if (pending.length > 0) {
      console.log('\n⚠️  Pending migrations (not yet applied):');
      pending.forEach(m => console.log(`   - ${m.name}`));
      process.exit(1);
    } else {
      console.log('✅ All local migrations are fully applied in the database.');
    }
  } catch (error) {
    console.error('❌ ERROR executing migrations check:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runCheck();
