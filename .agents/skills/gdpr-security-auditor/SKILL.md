---
name: gdpr-security-auditor
description: Scans database, SQL, S3, and API configurations to verify security policies and GDPR compliance controls.
---

# GDPR & Security Auditor

Verify that the system meets strict tenant isolation, GDPR data protection rules (Right to be forgotten, Data portability, Data minimization), and AWS security best practices.

## Description
This skill scans database queries, SQL migrations, and S3 file operations to ensure that customer data is isolated, secure, and compliance controls are met.

## How to Use
Run the validation script inside the backend directory:
```bash
cd Source/backend && npm run validate:security
```

Run this whenever DDL migrations or DB adapter code change. It is a **hard gate** — do not commit if it exits non-zero.

## Interpreting Output

| Output | Meaning | Action required |
|---|---|---|
| `[FAIL] Table X missing RLS` | Table has no Row-Level Security policy | Add `ALTER TABLE X ENABLE ROW LEVEL SECURITY` + isolation policy in migration |
| `[FAIL] No tenant context set` | An adapter queries without `SET LOCAL app.current_user_id` | Initialize tenant context before every query in the adapter |
| `[FAIL] S3 presign TTL > 300s` | Presigned URL expiry exceeds 5 minutes | Reduce TTL to ≤ 300s in the S3 adapter |
| `[FAIL] Cascade delete missing` | Delete on parent does not cascade to child | Add `ON DELETE CASCADE` FK or explicit delete in the GDPR purge path |
| `[WARN] Price observation table exempt` | Expected — POS store is RLS-exempt by design (§6.5 spec) | No action needed |
| Exit 0, no FAIL lines | All checks passed | Safe to commit |

## Details
* Script Location: `.agents/skills/gdpr-security-auditor/scripts/audit-security.ts`
