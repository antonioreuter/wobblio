import * as fs from 'fs';
import * as path from 'path';

const projectRootDir = path.resolve(__dirname, '../../../../');
const srcDir = path.join(projectRootDir, 'backend/src');

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

function auditPromptSecurity(filePath: string) {
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  // Simple check for prompt templates or strings
  const containsPrompt = content.toLowerCase().includes('prompt') || content.toLowerCase().includes('systeminstruction');

  if (containsPrompt) {
    // Check if XML tag structural boundaries are mentioned in the prompts (a best practice for Bedrock Claude)
    const usesXmlSeparators = content.includes('<') && content.includes('>');
    const mentionsJsonOutput = content.toLowerCase().includes('json') || content.toLowerCase().includes('schema');

    if (!usesXmlSeparators && (content.includes('Claude') || content.includes('bedrock') || content.includes('llm'))) {
      console.warn(
        `\x1b[33m[PROMPT WARNING]\x1b[0m ${path.relative(projectRootDir, filePath)}: File references LLM/Bedrock but prompt template might be missing XML tag separation markers (e.g. <receipt_text> or <instructions>).`
      );
    }

    if (!mentionsJsonOutput && (content.includes('extract') || content.includes('parse'))) {
      console.error(
        `\x1b[31m[PROMPT VIOLATION]\x1b[0m ${path.relative(projectRootDir, filePath)}: Prompt for extraction is missing instructions to output structured JSON or follow a specific schema.`
      );
      hasViolations = true;
    }

    const forbidsInstructionOverrides =
      content.toLowerCase().includes('untrusted') ||
      content.toLowerCase().includes('override') ||
      content.toLowerCase().includes('injection');

    if (!forbidsInstructionOverrides) {
      console.error(
        `\x1b[31m[PROMPT VIOLATION]\x1b[0m ${path.relative(projectRootDir, filePath)}: System prompt template is missing safety guardrails against prompt injection or instruction overrides (e.g., 'untrusted', 'override', or 'injection').`
      );
      hasViolations = true;
    }
  }
}

console.log('Running LLM Prompt Safety & Schema Auditor...');

scanFiles(srcDir, ['.ts'], (filePath) => {
  auditPromptSecurity(filePath);
});

if (hasViolations) {
  console.error('\x1b[31mPrompt security check failed!\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32mAll prompts passed compliance checks.\x1b[0m');
  process.exit(0);
}
