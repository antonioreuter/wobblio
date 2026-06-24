# 01 — CDK Hosting & WAF

**Epic 10 | Phase 5 | Isolated deployment for the admin console**

## Overview

The admin console is a separate Next.js app deployed to its own domain `admin.wobblio.com`, on its own
CloudFront distribution, isolated from the customer-facing `wobblio.com`. This sub-spec covers the
infrastructure: distribution, DNS, optional WAF/IP allowlist, and the deploy wiring. Rationale:
isolated attack surface, separate deploy cadence, no admin code reachable from the public app.

Parent: [12 — Admin Console](../12-admin-console.md).

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (the app being deployed)
- [02b — Deployment & Hosting](../02b-deployment-hosting.md) (existing hosting pattern to mirror)

## Hosting

Mirror the existing webapp hosting approach (see `02b`), in its own CDK stack (e.g. `WobblioAdminStack`):

- Separate CloudFront distribution for `admin.wobblio.com`, with its own origin (Next.js build of
  `Source/admin/`). Match the SSR-vs-static decision used by the main webapp.
- ACM certificate for `admin.wobblio.com` (us-east-1 for CloudFront).
- Route53 A/AAAA alias record → the distribution.
- Stage isolation consistent with the rest of the project (dev/prod), per the deployment-architecture
  memory: stage-aware names, no shared distribution.

## WAF / IP allowlist

- Attach an AWS WAF web ACL to the admin distribution with an **IP allowlist** rule (operator office /
  VPN egress ranges). Default action: block.
- Keep the list in SSM or a CDK context value so it is editable without a code change.
- This is defense-in-depth — the Cognito + `ADMIN` role gate from `00` is still the primary control.

## Checklist

- [ ] `WobblioAdminStack` (CDK/TypeScript) — separate CloudFront distribution for `admin.wobblio.com`
- [ ] ACM cert (us-east-1) + Route53 alias record
- [ ] Origin wired to the `Source/admin/` build; stage-aware (dev/prod)
- [ ] WAF web ACL with IP-allowlist rule attached to the distribution (list editable via SSM/context)
- [ ] Deploy script entry for the admin app (mirrors existing webapp deploy)
- [ ] `cdk synth` passes `cdk-nag`
- [ ] No admin routes/components reachable from the main `wobblio.com` distribution (verified)
