import * as fs from 'fs';
import * as path from 'path';

const projectRootDir = path.resolve(__dirname, '../../../../');
const backendDir = path.join(projectRootDir, 'backend');
const srcDir = path.join(backendDir, 'src');

let hasViolations = false;

function scanFiles(dir: string, fileExtensions: string[], callback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanFiles(fullPath, fileExtensions, callback);
    } else if (stat.isFile() && fileExtensions.some(ext => file.endsWith(ext))) {
      callback(fullPath);
    }
  }
}

// 1. Audit S3 Presigned URL expiration logic
function auditS3UploadConfigs(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('getSignedUrl') || content.includes('putObject') || content.includes('createPresignedPost')) {
    const expiresRegex = /(?:Expires|expiresIn)\s*:\s*(\d+)/g;
    let match;
    let foundExpiry = false;

    while ((match = expiresRegex.exec(content)) !== null) {
      foundExpiry = true;
      const seconds = parseInt(match[1], 10);
      if (seconds > 300) {
        console.error(
          `\x1b[31m[SECURITY VIOLATION]\x1b[0m ${path.relative(projectRootDir, filePath)}: S3 presigned URL expiration is too long (${seconds} seconds). GDPR data protection policies require a maximum of 300 seconds (5 minutes).`
        );
        hasViolations = true;
      }
    }

    if (!foundExpiry && (content.includes('expiresIn') || content.includes('Expires'))) {
       // Check if variables or config expressions are used
    } else if (!foundExpiry) {
      console.warn(
        `\x1b[33m[SECURITY WARNING]\x1b[0m ${path.relative(projectRootDir, filePath)}: S3 presigned URL generated but no explicit short expiration (expiresIn/Expires) was detected.`
      );
    }
  }
}

// 2. Audit Database queries for tenant isolation
function auditDatabaseQueries(filePath: string) {
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) return;

  const content = fs.readFileSync(filePath, 'utf-8');

  const hasDbQueries = content.includes('pg') || content.includes('query') || content.includes('SELECT') || content.includes('INSERT');
  if (hasDbQueries && filePath.includes('/adapters/db/')) {
    const setsTenantContext = content.includes('app.current_user_id') || content.includes('set_config') || content.includes('userId');
    if (!setsTenantContext) {
      console.error(
        `\x1b[31m[SECURITY VIOLATION]\x1b[0m ${path.relative(projectRootDir, filePath)}: Database queries executed without tenant context assignment or user isolation filters.`
      );
      hasViolations = true;
    }
  }
}

// 3. Scan SQL scripts for RLS configuration
function auditSqlFiles(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const normalizedContent = content.toUpperCase();

  if (normalizedContent.includes('CREATE TABLE')) {
    const hasRls = normalizedContent.includes('ENABLE ROW LEVEL SECURITY');
    const hasPolicy = normalizedContent.includes('CREATE POLICY');

    if (!hasRls || !hasPolicy) {
      console.error(
        `\x1b[31m[GDPR VIOLATION]\x1b[0m ${path.relative(projectRootDir, filePath)}: SQL script contains table creations but is missing Row-Level Security (RLS) policies.`
      );
      hasViolations = true;
    }
  }
}

console.log('Running GDPR & Security Compliance Auditor...');

// Scan backend TS source files
scanFiles(srcDir, ['.ts'], (filePath) => {
  auditS3UploadConfigs(filePath);
  auditDatabaseQueries(filePath);
});

// Scan SQL files inside the project (e.g. CDK/SAM DDL scripts)
scanFiles(projectRootDir, ['.sql'], (filePath) => {
  auditSqlFiles(filePath);
});

if (hasViolations) {
  console.error('\x1b[31mGDPR and Security verification failed! Audit findings must be resolved.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32mGDPR and Security compliance checks passed successfully!\x1b[0m');
  process.exit(0);
}
