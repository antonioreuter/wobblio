# 02b — Deployment & Hosting

**Phase 1 | Blocks Epic 06 (landing page) and all public API access**

## Overview

Static web hosting (S3 + CloudFront + Route53) for the Next.js webapp at `wobblio.com`, and a custom domain (`api.wobblio.com`) mapped to the API Gateway REST API via Route53. The admin console hosting (`admin.wobblio.com`) follows the same S3 + CloudFront pattern and is provisioned alongside Epic 12.

**No Amplify. No ECS. No server-side Next.js.** All compute runs on Lambda behind API Gateway. The webapp is a pure static export.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md) — `WobblioAppStack` (API Gateway) and hosted zone must exist

## Architecture

### Webapp — wobblio.com

```
Browser → CloudFront → S3 (private, OAC)
Route53 A (wobblio.com)     → CloudFront distribution
Route53 A (www.wobblio.com) → CloudFront distribution
```

- Next.js built with `output: 'export'` → static assets in `Source/webapp/out/`
- S3 bucket: private, block all public access, OAC (not OAI), enforceSSL, S3-managed encryption
- CloudFront Function rewrites clean URLs: `/about` → `/about.html`, `/` → `/index.html`
- 404 and 403 responses mapped to `/index.html` (200) so client-side routing works
- ACM certificate **must** be provisioned in `us-east-1` (CloudFront requirement); ARN is stored in SSM and read via Custom Resource in the WebStack deployed to `eu-west-1`
- Geo-restriction: EU + NL launch market (expand as warranted)
- `BucketDeployment` syncs `out/` to S3 and invalidates CloudFront cache on every `cdk deploy`

### Backend — api.wobblio.com

```
Browser / Mobile → api.wobblio.com → API Gateway REST API → Lambda
Route53 A (api.wobblio.com) → API Gateway custom domain
```

- API Gateway custom domain name: `api.wobblio.com`
- ACM certificate for `api.wobblio.com` in the same region as API Gateway (`eu-west-1`)
- Base path mapping: `/` → the `WobblioAppStack` REST API stage
- Route53 A record (alias): `api.wobblio.com` → API Gateway regional domain

### Admin Console — admin.wobblio.com *(provisioned in Epic 12)*

Same S3 + CloudFront pattern as the webapp, separate CDK stack (`WobblioAdminWebStack`). Deferred until Epic 12; placeholder checklist items are included below.

## CDK Stack Map

| Stack | Region | Contents |
|---|---|---|
| `WobblioWebCertStack` | `us-east-1` | ACM cert for `wobblio.com` + `www.wobblio.com`; ARN written to SSM |
| `WobblioWebStack` | `eu-west-1` | S3 bucket, CloudFront distribution, Route53 A records, BucketDeployment |
| `WobblioAppStack` *(existing)* | `eu-west-1` | API Gateway custom domain + Route53 A record added here |
| `WobblioAdminWebCertStack` *(Epic 12)* | `us-east-1` | ACM cert for `admin.wobblio.com`; ARN written to SSM |
| `WobblioAdminWebStack` *(Epic 12)* | `eu-west-1` | S3 bucket, CloudFront distribution, Route53 A record for admin |

## Next.js Constraint

`Source/webapp/next.config.ts` **must** set:

```ts
const nextConfig: NextConfig = {
  output: 'export',
};
```

Consequences that must be respected throughout all webapp epics:
- No SSR (`getServerSideProps` is forbidden)
- No Next.js API routes (`/app/api/` or `/pages/api/` handlers)
- No Server Components that fetch data — all data fetching is client-side via `api.wobblio.com`
- Dynamic routes require `generateStaticParams` if used

## Webapp Refactoring Required

The webapp currently contains two Next.js API routes and a direct PostgreSQL client that are **incompatible with `output: 'export'`** and violate the hexagonal architecture constraint. These must be removed before the first production build.

### Files to delete

| File | Reason |
|---|---|
| `Source/webapp/src/app/api/waitlist/status/route.ts` | Next.js API route — does not exist in static export |
| `Source/webapp/src/app/api/analytics/events/route.ts` | Next.js API route — does not exist in static export |
| `Source/webapp/src/lib/db.ts` | Direct `pg.Pool` connection from the webapp — hard architecture violation; DB is only accessible from Lambda inside the VPC |

### Lambda endpoints to create (Source/backend/)

These two endpoints replace the deleted routes. Both must be wired into API Gateway in `WobblioAppStack` and accessible at `api.wobblio.com`.

#### `GET /waitlist/status` (public, no auth)

- Reads `system_counter WHERE name = 'free_user_count'` via the DB port (compared against `max_free_users_cap`)
- Returns `{ waitlistActive: boolean }`
- Response header: `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
- No Cognito authorizer — this endpoint is called by unauthenticated landing page visitors
- Hexagonal: handler → `IWaitlistStatusPort` → `WaitlistStatusDbAdapter`

#### `POST /analytics/events` (public, no auth)

- Accepts `{ event: FunnelEvent }` where `FunnelEvent ∈ { hero_cta_click | pricing_view | signup_start | signup_complete | waitlist_join }`
- Validates event name against the allowed set; returns 400 on unknown event
- Enqueues a message to the analytics SQS queue (full `kpi_daily` write wired in Epic 15; stub SQS publish is sufficient here)
- No Cognito authorizer — called by unauthenticated landing page visitors
- Hexagonal: handler → `IAnalyticsQueuePort` → `SqsAnalyticsQueueAdapter`

### Webapp hooks to update

| File | Current call | Updated call |
|---|---|---|
| `src/hooks/use-waitlist-status/use-waitlist-status.ts:8` | `fetch('/api/waitlist/status')` | `fetch(\`${process.env.NEXT_PUBLIC_API_BASE_URL}/waitlist/status\`)` |
| `src/hooks/use-analytics/use-analytics.ts:7` | `fetch('/api/analytics/events', ...)` | `fetch(\`${process.env.NEXT_PUBLIC_API_BASE_URL}/analytics/events\`, ...)` |

### Environment variable

Add to `Source/webapp/.env.local` (dev) and as a build-time env var in the CDK `BucketDeployment` for production:

```
NEXT_PUBLIC_API_BASE_URL=https://api.wobblio.com
```

---

## SSM Parameter Conventions

| Parameter | Region | Set by | Read by |
|---|---|---|---|
| `/wobblio/web/certificate-arn` | `us-east-1` | `WobblioWebCertStack` | `WobblioWebStack` (Custom Resource) |
| `/wobblio/admin/certificate-arn` | `us-east-1` | `WobblioAdminWebCertStack` | `WobblioAdminWebStack` (Custom Resource) |
| `/wobblio/api/custom-domain` | `eu-west-1` | `WobblioAppStack` | operators / other stacks |

---

## Checklist

### WobblioWebCertStack (us-east-1)

- [ ] Deploy to `us-east-1` explicitly (`env: { region: 'us-east-1' }`)
- [ ] Look up Route53 hosted zone for `wobblio.com`
- [ ] Create ACM certificate: `wobblio.com` + SAN `www.wobblio.com`, DNS validation
- [ ] Write certificate ARN to SSM: `/wobblio/web/certificate-arn` in `us-east-1`
- [ ] cdk-nag passing on stack

### WobblioWebStack (eu-west-1)

- [ ] S3 bucket `wobblio-{stage}-web-assets-{account}`: block all public access, OAC, enforceSSL, S3-managed encryption, RETAIN on production
- [ ] Read certificate ARN from SSM `us-east-1` via `AwsCustomResource` (keyed physicalResourceId to domain so re-runs on domain change)
- [ ] CloudFront distribution:
  - [ ] `S3BucketOrigin.withOriginAccessControl` (OAC, not legacy OAI)
  - [ ] `ViewerProtocolPolicy.REDIRECT_TO_HTTPS`
  - [ ] `compress: true`
  - [ ] CloudFront Function (JS 2.0) for URL rewrite: `/` → `index.html`, `/foo` → `/foo.html`
  - [ ] Error responses: 404 and 403 → `/index.html` (HTTP 200, TTL 5 min)
  - [ ] Domain names: `wobblio.com`, `www.wobblio.com`
  - [ ] ACM certificate from SSM lookup
  - [ ] Geo-restriction: EU allowlist (NL + all EU/EEA/UK countries)
- [ ] Route53 A alias record: `wobblio.com` → CloudFront distribution
- [ ] Route53 A alias record: `www.wobblio.com` → CloudFront distribution
- [ ] `BucketDeployment`: source `Source/webapp/out/`, prune enabled, CloudFront invalidation `/*`
- [ ] Guard: if `out/` directory does not exist at synth time, create placeholder so `cdk synth` does not fail on clean checkout
- [ ] CfnOutputs: `WebUrl`, `CloudFrontDomainName`
- [ ] cdk-nag suppressions (S1 access logging, CFR2 WAF, CFR3 CF logging, CFR4 TLS, IAM5 BucketDeployment wildcard, IAM4 Lambda execution role, L1 runtime)
- [ ] cdk-nag passing on stack

### WobblioAppStack — API Custom Domain (eu-west-1)

- [ ] ACM certificate for `api.wobblio.com` in `eu-west-1` (regional endpoint, same region as API GW)
- [ ] API Gateway `DomainName` resource: `api.wobblio.com`, regional, above certificate
- [ ] `BasePathMapping`: `/` → REST API + deployed stage
- [ ] Route53 A alias record: `api.wobblio.com` → API Gateway regional domain name
- [ ] CfnOutput: `ApiUrl` = `https://api.wobblio.com`
- [ ] cdk-nag passing

### Webapp Refactoring

- [ ] Delete `Source/webapp/src/app/api/waitlist/status/route.ts`
- [ ] Delete `Source/webapp/src/app/api/analytics/events/route.ts`
- [ ] Delete `Source/webapp/src/lib/db.ts`
- [ ] Delete `Source/webapp/src/app/api/` directory entirely once empty
- [ ] Update `use-waitlist-status.ts`: replace `fetch('/api/waitlist/status')` with `fetch(\`${process.env.NEXT_PUBLIC_API_BASE_URL}/waitlist/status\`)`
- [ ] Update `use-analytics.ts`: replace `fetch('/api/analytics/events', ...)` with `fetch(\`${process.env.NEXT_PUBLIC_API_BASE_URL}/analytics/events\`, ...)`
- [ ] Add `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` to `Source/webapp/.env.local` (points to local Lambda emulator in dev)
- [ ] Update related unit tests (`route.test.ts` files) — delete them; Lambda handler tests live in `Source/backend/`

### Backend — New Lambda Endpoints

- [ ] `GET /waitlist/status` Lambda handler in `Source/backend/`
  - [ ] Port interface `IWaitlistStatusPort` in `src/core/ports/`
  - [ ] `WaitlistStatusDbAdapter` in `src/infrastructure/adapters/` querying `system_counter`
  - [ ] No Cognito authorizer on this route in API Gateway
  - [ ] Response includes `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
  - [ ] Unit test with mocked port (100% domain coverage)
- [ ] `POST /analytics/events` Lambda handler in `Source/backend/`
  - [ ] Port interface `IAnalyticsQueuePort` in `src/core/ports/`
  - [ ] `SqsAnalyticsQueueAdapter` in `src/infrastructure/adapters/`
  - [ ] Validates event name against allowlist; returns 400 on unknown
  - [ ] Publishes to analytics SQS queue (full `kpi_daily` consumer wired in Epic 15)
  - [ ] No Cognito authorizer on this route in API Gateway
  - [ ] Unit test with mocked port

### Next.js Webapp

- [ ] `Source/webapp/next.config.ts` has `output: 'export'`
- [ ] `npm run build` in `Source/webapp/` produces `out/` directory with no errors
- [ ] No `getServerSideProps` anywhere in the webapp
- [ ] No `/app/api/` or `/pages/api/` route handlers
- [ ] All API calls target `api.wobblio.com` via `NEXT_PUBLIC_API_BASE_URL`
- [ ] `npm run skill:hexagonal-architecture-validator` passes in `Source/backend/` after new Lambda handlers land

### Admin Console *(Epic 12 — placeholder)*

- [ ] `WobblioAdminWebCertStack` (us-east-1): cert for `admin.wobblio.com`, ARN → SSM `/wobblio/admin/certificate-arn`
- [ ] `WobblioAdminWebStack` (eu-west-1): same S3 + CloudFront pattern as `WobblioWebStack`
- [ ] Route53 A alias: `admin.wobblio.com` → admin CloudFront distribution
- [ ] Consider WAF IP allowlist on admin CloudFront distribution
