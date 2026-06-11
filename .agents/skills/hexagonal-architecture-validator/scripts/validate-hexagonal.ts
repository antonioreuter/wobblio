import * as fs from 'fs';
import * as path from 'path';

const projectRootDir = path.resolve(__dirname, '../../../../');
const backendSrcDir = path.join(projectRootDir, 'backend/src');
const coreDir = path.join(backendSrcDir, 'core');

let hasViolations = false;

function scanDirectory(dir: string) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
      checkImports(fullPath);
    }
  }
}

function checkImports(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;

  lines.forEach((line, index) => {
    let match;
    importRegex.lastIndex = 0;
    
    while ((match = importRegex.exec(line)) !== null) {
      const importPath = match[1];

      const isRelativeViolation = importPath.includes('/adapters') || importPath.includes('../adapters');
      const isAbsoluteViolation = importPath.startsWith('src/adapters') || importPath.startsWith('adapters');

      const isTestFile = filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts');

      if ((isRelativeViolation || isAbsoluteViolation) && !isTestFile) {
        const relativeFilePath = path.relative(projectRootDir, filePath);
        console.error(
          `\x1b[31m[HEXAGONAL VIOLATION]\x1b[0m ${relativeFilePath}:${index + 1} - Domain code must not import from adapters or infrastructure layer: "${importPath}"`
        );
        hasViolations = true;
      }
    }
  });
}

console.log('Running Hexagonal Architecture Dependency Validator...');
scanDirectory(coreDir);

if (hasViolations) {
  console.error('\x1b[31mHexagonal Architecture validation failed! Domain boundaries violated.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32mHexagonal Architecture boundaries verified successfully!\x1b[0m');
  process.exit(0);
}
