# 13a — Security Posture: Realignment + Three Real Hardening Items

**Parent:** [13 — Security Controls](../13-security-controls.md) · **Priority: P2 (one item
contradicts a hard invariant on paper; two are genuine unshipped controls on internet-facing
surfaces)** · **Tags:** [CONTRADICTION] [DRIFT] [GAP] · **DB migration:** none ·
**Gate:** `cdk synth` + cdk-nag on every stack touched.

## A. Spec-vs-invariant contradiction (fix the spec)

- **`13` S3 checklist: "Presigned URL expiry: 30 minutes for upload URLs."** This directly
  contradicts hard invariant #10 (≤300s) and the enforced code
  (`S3FileStorageAdapter.ts:12` — `MAX_TTL_SECONDS = 300`, clamped on both presign paths, comment
  literally says "hard invariant #10"). Fix the spec line to ≤300s. No code change.

## B. Posture drift (record the decision, don't silently revert it)

The spec's network section describes Lambdas in a VPC with RDS SG-to-SG rules. The deployed
posture — decided, not accidental — is: **Lambdas outside any VPC, no NAT gateway**, RDS in the
separate `shared-infra` project reached via TLS + IAM auth with a fail-closed RLS guard
(`WobblioBackendStack.ts` comment: "interim MVP posture… VPC placement is the target"). Also:
RDS/VPC live in `shared-infra`, not this repo's CDK, so half of 13's RDS checklist is not
verifiable here. Rewrite 13's network/database sections to state the interim posture, the trigger
for moving in-VPC (traffic), and which controls are owned by `shared-infra`.
Throttling shipped as burst 50 / rate 20 (`WobblioBackendStack.ts:690-691`), not the spec's
1000/500 — update the spec numbers to the deliberate (t3.micro-protective) values.

## C. Genuinely missing controls (build)

1. **WAF on API Gateway** — the only WebACL in the repo protects the admin CloudFront
   (`WobblioAdminCertStack.ts`). Spec 13 requires managed common-rules + IP-reputation on the API
   stage. Add a regional WebACL association to the API Gateway stage in `WobblioBackendStack`
   (cheapest managed rules only; capacity envelope is small).
2. **MFA for ADMIN** — Cognito pool is `mfa: OPTIONAL` (`WobblioAuthStack.ts:108`) and the admin
   console (NextAuth, same pool, DB-sourced role) never enforces MFA. cdk-nag COG2 expectation and
   spec 13 both require it for admins. Options (pick in implementation): Cognito conditional MFA
   is not per-role — enforce at the **admin app** layer: require a recent MFA-verified session
   (`amr` claim) in `Source/admin` middleware for mutating routes, and provision OTP for the
   handful of admin accounts. Keep OPTIONAL for regular users.
3. **CSP headers on the webapp** — spec'd, not configured (OpenNext SSR: set headers in
   `next.config`). Low effort, do with the same pass.

## Out of scope

Secrets-rotation automation (DB uses IAM tokens, not passwords — spec text should be corrected
under B), moving Lambdas into the VPC (pre-decided scaling ladder owns that), Stripe secrets
(05a owns).
