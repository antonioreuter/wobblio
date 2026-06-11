import * as fs from 'fs';
import * as path from 'path';

const projectRootDir = path.resolve(__dirname, '../../../../');
const mobileDir = path.join(projectRootDir, 'mobile'); // Mock or actual flutter directory
const backendDir = path.join(projectRootDir, 'backend');

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

function auditExifStripping(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const hasUpload = content.includes('upload') || content.includes('S3') || content.includes('Image');

  if (hasUpload) {
    // Check if there are indicators of metadata stripping or exif libraries
    const referencesExifStripping = content.toLowerCase().includes('exif') || 
                                   content.toLowerCase().includes('strip') || 
                                   content.toLowerCase().includes('metadata') || 
                                   content.toLowerCase().includes('compress');

    if (!referencesExifStripping && filePath.includes('/mobile/')) {
      console.warn(
        `\x1b[33m[GDPR WARNING]\x1b[0m ${path.relative(projectRootDir, filePath)}: File uploads images but does not explicitly reference metadata stripping or EXIF removal routines. EXIF headers containing GPS location data must be stripped client-side.`
      );
    }
  }
}

console.log('Running EXIF Data Compliance Auditor...');

// Check mobile codebase files if directory exists
if (fs.existsSync(mobileDir)) {
  scanFiles(mobileDir, ['.dart'], (filePath) => {
    auditExifStripping(filePath);
  });
} else {
  console.log('Mobile app directory not found. Skipping client EXIF check.');
}

if (hasViolations) {
  console.error('\x1b[31mEXIF compliance check failed!\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32mEXIF metadata isolation checks completed.\x1b[0m');
  process.exit(0);
}
