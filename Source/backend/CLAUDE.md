# Wobblio Backend

Node/TypeScript Lambda fleet + CDK infrastructure for the Wobblio ingestion, API, billing, and admin paths. Read the root `CLAUDE.md` first — invariants there apply here unconditionally.

**Status:** scaffolding stage. Use this file as the convention reference as code lands; do not stray from it without an explicit decision recorded in `docs/`.

## Required architecture: hexagonal (ports & adapters)

```
src/
  core/
    services/      # business logic — pure, framework-agnostic
    ports/         # interfaces for every external capability (DB, Bedrock, S3, Cognito, Stripe, …)
    domain/        # entities, value objects, domain errors
  infrastructure/
    adapters/      # concrete implementations of ports (AWS SDK v3, pg, stripe-node, …)
    config/        # SSM loaders, environment wiring
  handlers/        # Lambda entry points — thin, only translate event → core invocation → response
  cdk/             # CDK stacks (WobblioDbStack, WobblioAuthStack, WobblioStorageStack, WobblioObservabilityStack, WobblioBackendStack)
  prompts/         # versioned LLM prompt artifacts (Appendix B contracts). prompt_version is mandatory.
  migrations/      # node-pg-migrate files; managed via the database-migrations skill
  tests/
    unit/          # Vitest, mocked ports, fast
    integration/   # real Postgres + LocalStack adapters
    acceptance/    # Playwright E2E against the deployed local stack
```

**The golden rule:** `src/core/` MUST NOT import from `src/infrastructure/`, `@aws-sdk/*`, `aws-jwt-verify`, `stripe`, `pg`, or any other SDK. Use ports. The validator (`npm run skill:hexagonal-architecture-validator`) enforces this — exit 0 is non-negotiable before commit.

Ports are split by capability (ISP): `IBedrockChatClient`, `IBedrockEmbedder`, `IS3FileStorage`, `ICognitoIdentityManager`, `IStripeBillingClient`, `ITenantRepository`, `IInvoiceRepository`, `IPriceObservationStore`, `IIngestionLedger`, …  Never create a monolithic `IInfrastructurePort`.

Adapters map SDK/infra errors to domain errors (`UserNotFoundError`, `QuotaExceededError`, `DuplicateInvoiceError`, …). Core throws only domain errors.

## Clean Code constraints (enforced in review)

- Functions do one thing; target < 20 lines.
- Guard clauses, fail fast. Happy path left-aligned, ≤ 2 levels of nesting.
- Intent-revealing names. No `data`, `handle`, `process`, `manager` without a qualifier.
- AHA / YAGNI / Rule-of-Three. Don't abstract before the third occurrence.
- Default to no comments. One short line max when the *why* is non-obvious.
- No backwards-compat shims, dead-code re-exports, or `// removed:` markers.

## Database & RLS (the part that breaks loudly when ignored)

Tenant-scoped tables are **all** RLS-protected via:

```sql
SET LOCAL app.current_tenant_id = '<uuid>';
```

Every API Lambda must set this **before** the first query in the transaction. The `ITenantContext` port owns this — handlers call it, adapters consume it. Direct `pg` calls from handlers are a review reject.

Globally readable tables (no RLS): `merchant`, `merchant_branch`, `merchant_alias`, `product_category`, `product_concept`, `product`, `product_alias`, `price_observation`, `fx_rate`, `system_counter`, `migration_ledger`, `limits`, `ai_spend_ledger`, `tenant_trust`, `tenant_signature`, `payment_transaction`, `kpi_daily`. Treat these with care: writes to catalog tables go through the canonicalization/quarantine pipeline (§6.8), never raw inserts from a handler.

Migrations: use the `database-migrations` skill. Never edit a migration that has shipped — write a new one.

## Connection management (db.t3.micro budget)

- Reserved concurrency: `api-handlers ≤ 25`, `ingestion-worker ≤ 5` (SQS `maxConcurrency`), `crons ≤ 2`. Worst case ~32 connections, safe under t3.micro's ~85 ceiling.
- One pg connection per warm Lambda container, created lazily.
- IAM auth tokens regenerated when older than 10 minutes (they expire at 15).
- Statement timeout: 5s on API, 30s on workers.
- Scaling ladder is pre-decided in §7.3.1 — do not raise concurrency caps before adding RDS Proxy.

## Ingestion worker (the product's core path)

Single SQS consumer Lambda implementing the §6 pipeline in this exact order:

1. Idempotency: `INSERT ingestion_ledger ON CONFLICT DO NOTHING` — short-circuit on duplicate delivery.
2. Deduplication: SHA-256 same-tenant reject; cross-tenant hash collision voids corroboration and flags the cluster (§6.8 Layer 1a). Fuzzy fingerprint after parse marks `SUSPECTED_DUPLICATE`.
3. Vision parse (Bedrock vision, schema-validated, one retry-with-errors, then DLQ).
4. Merchant canonicalization (alias hard hit → exact → pg_trgm fuzzy → LLM fallback).
5. Product normalization + categorization (per-line alias → batch LLM expansion → pgvector match → write-back).
6. Invoice classification (merchant prior → line-item vote → LLM tiebreak only on disagreement).
7. Tag generation (§6.10): deterministic first; LLM piggybacks only when the §6.3 expansion call runs.
8. Tenant writes (`invoice`, `invoice_line`) inside the ledger-keyed transaction.
9. Price observation emission — **anonymized, no RLS, no tenant ref, day-precision date, postal-prefix region.**
10. Push notification + `PARSED | NEEDS_REVIEW` status flip.

Partial-batch failures via `ReportBatchItemFailures`. `maxReceiveCount=3` → DLQ. Per-stage timing/token metrics via CloudWatch EMF (dimensions: `Stage`, `ModelId`, `InputTokens`, `OutputTokens`). Per-tenant daily AI-spend soft cap read from SSM.

Tags **must never** be written to the Price Observation Store. The emission code path has no tag parameter — keep it that way.

## Bedrock prompts

- Prompts are versioned artifacts in `src/prompts/` (per Appendix B).
- Use XML tag separators (`<receipt>…</receipt>`, `<candidates>…</candidates>`) — see `.claude/rules/ai-prompt-extraction-engineer.md`.
- Every model invocation records `prompt_version` into `invoice_feedback.model_ids_snapshot` for the swap-comparison flow.
- Schema-validate every output. On validation failure, retry once with the validation errors echoed back; on second failure, route to DLQ.
- Model IDs come from SSM (`/wobblio/config/models/{vision_parser,auxiliary,embedder,insight}`) — never hardcode.

## Testing tiers

| Tier | Tool | Scope | Skill |
|---|---|---|---|
| Unit | Vitest | Core services with mocked ports | `write-unit-test` |
| Integration | Vitest | Real Postgres + LocalStack adapters | `write-integration-test` |
| Acceptance (E2E) | Playwright | Deployed local stack, `data-testid` selectors, polling loops over sleeps | `write-acceptance-test`, `.claude/rules/e2e-testing-coordinator.md` |

Seed a unique tenant per E2E run. Domain coverage target on `src/core/`: 100% via mocked ports.

## Commands (intended — populate as scripts land)

```
npm run dev                                # local Lambda hot-reload against LocalStack
npm run test:unit                          # Vitest unit suite
npm run test:integration                   # Vitest integration suite
npm run test:e2e                           # Playwright acceptance suite
npm run skill:hexagonal-architecture-validator
npm run validate:security                  # GDPR/security auditor (run on DDL/adapter changes)
npm run migrate:up | migrate:down          # node-pg-migrate
npm run cdk:synth                          # cdk synth, must pass cdk-nag
./deploy-local.sh                          # bootstrap + deploy to LocalStack + seed
```

## DoD checklist for any backend change

- [ ] Zero infrastructure leakage in `src/core/` (validator exit 0)
- [ ] Guard clauses, ≤ 2 nesting levels
- [ ] No premature abstraction (Rule of Three)
- [ ] Domain coverage via mocked unit tests
- [ ] Security/GDPR validator green on DDL/adapter changes
- [ ] CDK synth + cdk-nag pass
- [ ] If the change touches the ingestion worker: per-stage metrics still emitted; idempotency intact
- [ ] If the change touches RLS-scoped tables: `SET LOCAL` happens before the first query and the test seeded a tenant
