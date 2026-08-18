# Wobblio

Cloud-native personal fiscal management utility. Photographs of receipts become structured financial data via multimodal AI; anonymized price points feed a crowdsourced regional price index that powers the differentiating features (Anti-Inflation Price Engine, Split-Route Shopping Optimizer, proactive budget protection).

**Status:** MVP built and deployed to the `dev` stage — backend, webapp, admin console, and Flutter client all exist. Work is now incremental features, fixes, and hardening. Read the code before assuming anything is unbuilt.

## NON NEGOTIABLE
- Under any circumstance connect to the Production environments in AWS neither execute scripts in this environment. The same is also valid for the database in prod or any db schema related to production environment. 

## Git workflow

- **Trunk-based, no branches, no pull requests.** All work is committed directly to `main` and pushed to `origin/main`. Do not create feature branches or open PRs.
- **Commit and push only when the user asks.** Committing directly to `main` does not license you to commit unprompted — wait for an explicit instruction, then commit and push to `origin/main`.
- **Use git worktrees for concurrent work.** When multiple sessions run simultaneously on different tasks, isolate each in its own git worktree so they don't collide in the same working directory. Each worktree still targets `main` — the worktree is the isolation boundary, not a branch-and-merge workflow. Sync (`git pull --rebase`) before pushing so concurrent worktrees land cleanly on `origin/main`.

## Source of truth (read these before non-trivial work)

**All specification work goes through OpenSpec.** New behavior is proposed as an OpenSpec change and lands in `openspec/specs/`; nothing else is edited as a spec.

Precedence, highest first:

1. `openspec/specs/<capability>/spec.md` — **authoritative for system behavior.** Capability paths mirror `Source/backend/src/core/services/`. Seeded so far: `ingestion`, `data-intelligence`, `quota`, `admin`. A capability with no spec yet is unspecified — the first change that touches it authors its baseline **from the code**, never from the frozen documents below.
2. This file — the hard invariants and validation gates.
3. `.claude/rules/*.md` — engineering policy.
4. `docs/wobblio_v2.4_specification_final.md` — **authoritative for product only**: definition, business model, financial model, decisions log, feature set, design briefs. Section numbers (§) referenced throughout resolve here. Where it describes *behavior*, the OpenSpec capability spec wins.
5. `docs/runbook.md`, `docs/runbooks/`, `docs/database-setup.md` — operations, not specification.
6. `specs/` — **FROZEN and historical** as of 2026-08-18. See `specs/README.md`. Known to have diverged from the code; read for rationale, never plan from it.

**MCP RAG Server (`projects-rag`):** semantic search over a **June 2026 snapshot** of `docs/` and `specs/`. Verified 2026-08-18: it does **not** index `openspec/specs/`, and its `specs/` copy stops at `mvp/00-15` — no `fixes/`, no `price-trends-*`, no mobile `16-19`. It is therefore *staler than the frozen tree on disk*. Use it for orientation and rationale only; never for current behavior, and never as a substitute for reading `openspec/specs/` or the code.

### Working with OpenSpec

- `/opsx:propose` — create a change with proposal, delta specs, design, and tasks
- `/opsx:apply` — implement the tasks of an approved change
- `/opsx:archive` — fold a completed change's deltas into `openspec/specs/`
- `openspec/config.yaml` carries the project context and the per-artifact rules

Planning and implementation are separate steps: a propose run produces artifacts and stops.

## Stack

- **Mobile:** Flutter (iOS + Android) — capture-first, offline shopping lists, review screen
- **Web:** Next.js + Tailwind — command center, admin console, billing/checkout
- **Backend:** AWS Lambda (Node/TypeScript, SDK v3), API Gateway, SQS, S3, RDS PostgreSQL db.t3.micro
- **AI:** AWS Bedrock Converse — vision (Qwen-class), auxiliary (Haiku-class), insight (Sonnet-class), embedder (Titan V2, 512-dim). Model IDs are opaque SSM values (`/wobblio/config/models/*`), swappable live.
- **IaC:** CDK/TypeScript, multi-stack (`WobblioDbStack` separate from app stacks), gated by `cdk-nag`
- **Auth/Billing:** Cognito (Google/Meta federation) · Stripe Checkout + webhooks (web-only, never in-app)
- **DB extensions:** `pg_trgm` (alias fuzzy match) + `pgvector` (product embeddings)
- **Launch market:** Netherlands, Eindhoven region (single metro for price-data density)

## Hard invariants (do not violate without spec amendment)

1. **Tenant isolation via RLS + `SET LOCAL app.current_tenant_id`** on every API path. Tenant = user, or household for household-space rows. (§7 / §8)
2. **The Price Observation Store is exempt from RLS by design** and stores no tenant/user/invoice/household reference. De-identification is the trade for cross-tenant aggregation. (§6.5)
3. **Hexagonal architecture is non-negotiable.** `src/core/` never imports from `src/infrastructure/` or any SDK. Ports live in `src/core/ports/`; adapters in `src/infrastructure/adapters/`. See `.claude/rules/code-quality-guard.md`.
4. **Subscriptions sell through Stripe web checkout only** — no in-app purchase, ever. Mobile deep-links to web. (§2.2)
5. **Role column is never writable by client APIs.** Only the Stripe webhook (`STANDARD ↔ PREMIUM`) and operator scripts (`TESTER`, `ADMIN`) flip it. (§2.3)
6. **Quotas are enforced in one domain service** with the matrix in §2.4. Household pool is additive on household-space uploads; it does not borrow from personal.
7. **Idempotency-first ingestion:** SQS consumer's first write is `INSERT ingestion_ledger ON CONFLICT DO NOTHING`. Same-tenant SHA-256 duplicates are rejected at presign-confirm (zero AI tokens). Cross-tenant hash collisions void corroboration per §6.8 Layer 1a.
8. **Catalog entities are PROVISIONAL on auto-creation** and only globally visible after the Sybil-gated quorum or admin approval. A serving cell still needs k≥3 distinct observations at read time. (§6.8, Appendix A)
9. **Encryption scope is narrow:** AES-GCM (KMS envelope) only on free-text notes, household invite tokens, exported-report URLs, invoice/shopping-list share tokens, contact names for splitting. Never amounts, merchants, products, categories, dates. (§7.5)
10. **Presigned S3 URLs expire in ≤300s.** Bucket blocks all public access. (`.claude/rules/serverless-iac-architect.md`)
11. **GDPR boundary:** account deletion is a two-phase soft-lock + 30-day hard purge. Anonymized price observations survive (never personal data after de-identification). `payment_transaction` rows kept 7 years with the user ref replaced by an opaque audit token. (§6.5.4, Epic 13)
12. **Bedrock prompts use XML tag separators** and must conform to a JSON schema validator with one retry-with-errors before DLQ. (Appendix B, `.claude/rules/ai-prompt-extraction-engineer.md`)

## Project rules already authored (apply automatically)

`.claude/rules/` carries the durable policy:

- `code-quality-guard.md` — hexagonal architecture, SOLID, Clean Code, Rule-of-Three, DoD checklist
- `gdpr-privacy-officer.md` — RLS coverage, tenant context init, GDPR delete cascade, presign TTL, `npm run validate:security`
- `serverless-iac-architect.md` — RDS in private subnets, IAM least privilege, S3 lockdown, Cognito authorizer + rate limits
- `flutter-architecture-guard.md` — BLoC, ports/adapters at native boundaries, exif strip before upload
- `ai-prompt-extraction-engineer.md` — XML separators, schema-conformant outputs, normalization via Levenshtein + embeddings
- `e2e-testing-coordinator.md` — Playwright `data-testid`, polling over sleeps, per-test tenant seeding, mock server

Read the relevant rule before touching the matching area.

## Repository layout

```
Source/
  backend/          Node/TypeScript Lambda fleet, CDK stacks, ingestion worker, migrations
  webapp/           Next.js app + admin console
docs/               Authoritative specs (can be read directly or queried via projects-rag MCP server)
specs/mvp/          Epic-level implementation specs (can be read directly or queried via projects-rag MCP server)
invoices/           Sample receipt fixtures for parsing tests
.claude/
  rules/            Durable policy applied to every relevant change
  skills/           Project-specific skills (qa, dev, po, validators, generators)
  agents/           Sub-agent definitions
```

(`Source/mobile/` will land later — Flutter app is in the backlog but the directory does not exist yet.)

## Phase map (specs/mvp)

| Phase | Files | Blocking |
|---|---|---|
| 0 | `00` | design system → everything client-side |
| 1 | `01`–`03` | sandbox, DB+RLS, observability foundation |
| 2 | `04`–`05` | Cognito + waitlist, Stripe billing |
| 3 | `06`–`08` | landing, ingestion pipeline, data-intelligence layer |
| 4 | `09`–`11` | households, budgets + lists + optimizer, splitting + FX + reporting |
| 5 | `12`–`15` | admin console, security controls, GDPR, full observability + KPIs |
| Mobile | `16` | Flutter capture/review client + push delivery (post-MVP; `Source/mobile/` lands here) |

Capacity envelope is enforced, not aspirational: ~10k registered users, ~4k MAU, ~3k ingestions/day on db.t3.micro. The waitlist guardrail (§2.5) is the load-shedding mechanism.

## Validation gates (run before claiming done)

Backend changes:
- `cd Source/backend && npm run skill:hexagonal-architecture-validator` (exit 0 required)
- `cd Source/backend && npm run test:unit` (mocked ports, 100% domain coverage target)
- `cd Source/backend && npm run validate:security` whenever DDL migrations or DB adapters change
- `cdk synth` must pass `cdk-nag` rules

Client changes touching capture/upload: confirm exif-strip and ≤1MB JPEG compression happen client-side before S3 PUT.

## Technology stack

- Backend: Node.js 24, AWS Lambda, S3, RDS PostgreSQL (t3.micro)
- Frontend: Next.js, Tailwind CSS
- Mobile: Flutter (in backlog)
- AI: AWS Bedrock Converse (Qwen-class), Haiku-class, Sonnet-class, Titan V2 embeddings
- Database: PostgreSQL with pg_trgm and pgvector extensions
- Authentication: AWS Cognito
- Payments: Stripe Checkout
- Infrastructure: AWS CDK/TypeScript, CDK-nag

## When in doubt

Read the spec section, then the matching `specs/mvp/` file, then the matching `.claude/rules/` policy, then write code. If still ambiguous, ask — do not invent.
