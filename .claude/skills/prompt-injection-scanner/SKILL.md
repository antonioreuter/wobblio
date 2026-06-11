---
name: prompt-injection-scanner
description: Statically checks all prompt template strings for prompt injection mitigations and schema structures.
---

# Prompt Injection Scanner

Verify that prompts sent to LLM extraction engines (e.g. AWS Bedrock Claude models) contain necessary safety isolation and output instructions.

## Description
This skill scans source code files (under `backend/src/`) for LLM prompt structures, checking that:
- Prompts utilize strict XML tags (`<user_input>`, `<instructions>`, etc.) to separate system instructions from dynamic inputs.
- Prompts contain instruction to output valid structured JSON matching schemas.
- Prompts explicitly forbid external link processing or instruction overrides.

## How to Use
Run the scanner script inside the backend directory:
```bash
npm run validate:prompts
```

## Details
* Script Location: `/.agents/skills/prompt-injection-scanner/scripts/scan-prompts.ts`
