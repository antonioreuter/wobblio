# 12g — Admin Deployment (CDK)

**Epic 10 | Phase 5 | Parent: [12 — Admin Console](../12-admin-console.md)**

Stand up `admin.wobblio.com` as a separate, locked-down distribution. Independent of 12b–12f —
those run locally (`:3001`) until this lands; deploy last.

## Dependencies

- [12a — Admin Foundation](./12a-admin-foundation.md) (the app being deployed)
- [02b — Deployment & Hosting](../02b-deployment-hosting.md) (webapp OpenNext SSR precedent)
- `.claude/rules/serverless-iac-architect.md`

## Infrastructure

New stack `WobblioAdminWebStack` (mirror the webapp's OpenNext SSR deploy from 02b):

- OpenNext SSR build of `Source/admin/` (SSR, not static export — admin uses NextAuth server
  session, same as the webapp).
- **Separate** CloudFront distribution + Route53 A record for `admin.wobblio.com` (distinct from
  `wobblio.com`).
- ACM cert for the admin subdomain.
- **WAF web ACL with IP allowlist** on the admin distribution (shared access-control rule).
- SSR Lambda env wired like the webapp: Cognito client/issuer, `AUTH_SECRET`, `API_BASE_URL`
  (memory `ssr-auth-env`, `infra-gotchas` — runtime `API_BASE_URL`, never baked at build).
- Stage isolation per existing convention (`config.dbSecretParam` etc., memory
  `deployment-architecture`).

cdk-nag must pass; no public S3; least-privilege IAM.

## Open decisions

- WAF allowlist source (operator office IPs / VPN egress) — provide as a stack parameter/SSM
  list, not hardcoded.
- Whether the admin SSR Lambda runs outside the VPC like the webapp (memory `shared-infra`) —
  default yes.

## Checklist

- [ ] `WobblioAdminWebStack` — OpenNext SSR for `Source/admin/`
- [ ] Separate CloudFront distribution + Route53 A record + ACM cert for `admin.wobblio.com`
- [ ] WAF web ACL IP allowlist (allowlist via parameter/SSM, not hardcoded)
- [ ] SSR Lambda env: Cognito + `AUTH_SECRET` + runtime `API_BASE_URL`; stage-isolated
- [ ] cdk-nag clean; no public S3; least-privilege IAM
- [ ] `npm run cdk:synth` passes

## Verification

- `cdk synth` passes cdk-nag. After deploy: `admin.wobblio.com` serves the admin app over the
  allowlisted distribution; a non-allowlisted IP is blocked by WAF; an ADMIN from an allowlisted
  IP authenticates and reaches the console; a non-ADMIN gets `/403`.
