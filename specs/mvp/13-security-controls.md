# 13 — Security Controls

**Epic 11 | Phase 5 (continuous from Phase 1) | Day-0 security posture**

## Overview

Day-0 security controls verified by `cdk-nag` from Phase 1 onward. This epic is continuous — cdk-nag gates every deploy and security controls are wired into the CDK stacks from the beginning, not added at the end.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md) (all infrastructure)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)

## Security Controls

### Network (Default VPC, Hardened SGs)

- Lambda functions in the default VPC (no custom VPC needed at launch cost)
- RDS security group: inbound port 5432 allowed **only from the Lambda security group**
- Lambda security group: outbound HTTPS (443) to AWS services + Bedrock; no inbound
- No public access to RDS (public accessibility: false)
- All traffic to Bedrock over VPC endpoint or AWS backbone (not public internet where possible)

### Database

- IAM token authentication only (no password-based connections)
- TLS enforced on all RDS connections (`sslmode=require`)
- Storage-level encryption: KMS-managed key (enabled at RDS creation)
- CPU Unlimited: OFF (runaway query protection)
- Automated backups: 7-day retention
- RLS enforced on all tenant tables via `SET LOCAL app.current_tenant_id`

### Lambda & API Gateway

- JWT authorizer on all non-public API Gateway routes
- WAF (basic managed rules) on API Gateway stage
- No Lambda function URLs exposed (only via API Gateway)
- API Gateway throttling: 1000 RPS burst, 500 RPS steady per stage (adjust via SSM)
- Lambda execution roles: least-privilege IAM policies (no `*` permissions)
- Lambda VPC configuration: in the same VPC as RDS, security group rules as above
- Lambda environment variables: no secrets in env vars; all secrets from Secrets Manager at runtime

### Secrets Management

- DB secret: Secrets Manager (auto-rotation every 30 days)
- Stripe webhook secret: Secrets Manager per environment
- Stripe API key: Secrets Manager per environment
- KMS CMK: managed by AWS KMS, key rotation enabled
- No hardcoded secrets in code or CDK constructs

### S3 Buckets

- All buckets: `BlockPublicAcls: true`, `BlockPublicPolicy: true`, `IgnorePublicAcls: true`, `RestrictPublicBuckets: true`
- Uploads bucket: presigned URL access only (no public read)
- Server-side encryption: SSE-S3 minimum; SSE-KMS for billing archive
- Access logging enabled on exports bucket (GDPR audit trail)
- Versioning enabled on billing archive bucket

### cdk-nag Configuration

Rules applied from synthesis gating:
- `AwsSolutions-IAM4`: no AWS managed policies with `*` actions
- `AwsSolutions-IAM5`: no wildcards in IAM resource ARNs
- `AwsSolutions-L1`: Lambda runtime must be current/maintained version
- `AwsSolutions-RDS2`: RDS storage encryption required
- `AwsSolutions-RDS6`: RDS IAM auth required
- `AwsSolutions-RDS10`: RDS deletion protection (prod only)
- `AwsSolutions-S1`: S3 server access logging (exports bucket)
- `AwsSolutions-APIG4`: API Gateway must have authorizer
- `AwsSolutions-COG1`: Cognito user pool must have password policy
- `AwsSolutions-COG2`: Cognito user pool MFA (required for ADMIN users)

### Application Security

- Input validation at all API boundaries (zod schema validation)
- SQL injection: parameterized queries only (never string interpolation in SQL)
- XSS: Next.js default CSP; sanitize any user-provided HTML
- CSRF: SameSite cookies; Stripe webhook signature verification
- Rate limiting: API Gateway throttling + per-user quota enforcement
- Cognito pre-signup Lambda protects against account enumeration

### KMS Field-Level Encryption (Narrow Scope)

Applied only to (§7.5):
- `bill_split_line.participant_name_enc`
- `invoice_feedback.comment_enc`
- `data_request.export_s3_key`
- Household invite tokens at rest
- Personal notes (if implemented)

NOT applied to: amounts, merchants, products, categories, dates (these are protected by RLS + storage encryption + IAM).

---

## Checklist

### Network & VPC
- [ ] Lambda security group: outbound HTTPS only; no inbound
- [ ] RDS security group: inbound port 5432 from Lambda SG only; no other inbound
- [ ] No public RDS access (`PubliclyAccessible: false` in CDK)
- [ ] Bedrock endpoint: use VPC endpoint if available in launch region, else AWS backbone

### RDS Security
- [ ] IAM token authentication enabled on RDS instance
- [ ] Lambda IAM role has `rds-db:connect` permission (specific DB user)
- [ ] TLS enforced: `sslmode=require` in all connection strings
- [ ] Storage encryption: KMS-managed key
- [ ] Automated backups: 7-day retention
- [ ] Deletion protection: enabled in prod stack
- [ ] CPU Unlimited: disabled

### Lambda Security
- [ ] Lambda execution roles: per-function-group, least-privilege
- [ ] API handler role: access to RDS (IAM token), SSM (reads), Secrets Manager (DB secret), SQS (send)
- [ ] Ingestion worker role: access to RDS, S3 (read uploads), SQS (consume + DLQ), Bedrock (invoke), SSM
- [ ] Cron roles: access to RDS, SSM, SNS (publish), SES (send), SQS (send)
- [ ] No `*` in any IAM resource ARN (cdk-nag AwsSolutions-IAM5)
- [ ] No AWS managed `*` policies (cdk-nag AwsSolutions-IAM4)

### API Gateway Security
- [ ] JWT authorizer on all routes except: `GET /waitlist/status`, Stripe webhook endpoint, public auth routes
- [ ] WAF WebACL attached to API Gateway stage: managed rules (AWSManagedRulesCommonRuleSet, AWSManagedRulesAmazonIpReputationList)
- [ ] API Gateway throttling: configure burst and steady-state limits
- [ ] No Lambda function URLs exposed publicly

### S3 Security
- [ ] All buckets: public access block enabled on all four settings
- [ ] Presigned URL expiry: 30 minutes for upload URLs
- [ ] Server-side encryption: SSE-KMS for billing archive; SSE-S3 minimum for others
- [ ] Access logging on exports bucket
- [ ] Versioning on billing archive bucket

### Secrets Management
- [ ] DB secret in Secrets Manager with auto-rotation
- [ ] Stripe secrets in Secrets Manager per environment
- [ ] No secrets in Lambda environment variables
- [ ] KMS CMK: key rotation enabled annually
- [ ] CDK: Secrets Manager references not inlined at synth time

### cdk-nag Integration
- [ ] `cdk-nag` added as a CDK aspect to all stacks from Phase 1
- [ ] CI pipeline: `cdk synth` must pass cdk-nag with zero errors before any `cdk deploy`
- [ ] Suppressions documented with justification in CDK code for any necessary nag rule suppressions
- [ ] Rules list above applied to all stacks

### Application-Level Security
- [ ] All API inputs validated with zod (or equivalent) — schema defined for every endpoint
- [ ] Parameterized queries only — no string interpolation in SQL
- [ ] Content Security Policy headers on Next.js web app
- [ ] Stripe webhook signature verification (every webhook request)
- [ ] Cognito: password policy configured (min 8 chars, complexity)
- [ ] MFA: optional for STANDARD/PREMIUM; required for ADMIN (cdk-nag COG2)
- [ ] CORS: API Gateway CORS configured for web app origin only (not `*`)

### KMS Encryption Implementation
- [ ] Envelope encryption helper: generate data key from CMK, encrypt field, store encrypted data key + ciphertext
- [ ] Decrypt helper: decrypt data key with CMK, decrypt field
- [ ] Applied to: `participant_name_enc`, `comment_enc`, `export_s3_key`, household invite tokens
- [ ] Key rotation: CMK annual rotation enabled; re-encryption of existing data on rotation (or use data key versioning)
