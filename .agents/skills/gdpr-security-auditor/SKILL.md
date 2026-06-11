---
name: gdpr-security-auditor
description: Scans database, SQL, S3, and API configurations to verify security policies and GDPR compliance controls.
---

# GDPR & Security Auditor

Verify that the system meets strict tenant isolation, GDPR data protection rules (Right to be forgotten, Data portability, Data minimization), and AWS security best practices.

## Description
This skill scans database queries, SQL migrations, and S3 file operations to ensure that customer data is isolated, secure, and compliance controls are met.

## How to Use
Run the validation script using npm inside the backend directory:
```bash
npm run validate:security
```

## Details
* Script Location: `.agents/skills/gdpr-security-auditor/scripts/audit-security.ts`
