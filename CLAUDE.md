# Wobblio

Cloud-native personal fiscal management utility. Photographs of receipts become structured financial data via multimodal AI; anonymized price points feed a crowdsourced regional price index that powers the differentiating features (Anti-Inflation Price Engine, Split-Route Shopping Optimizer, proactive budget protection).

**Status:** spec-complete (v2.4), implementation starting. `Source/backend/` and `Source/webapp/` are empty placeholders.

## Source of truth (read these before non-trivial work)

- `docs/wobblio_v2.4_specification_final.md` — the authoritative spec. Section numbers below reference it.
- `specs/mvp/` — implementation-ready spec per epic, numbered by build order (00 → 15). Start at `specs/mvp/README.md`.
- **MCP RAG Server (`projects-rag`):** You have access to the `projects-rag` MCP server, which runs a RAG solution indexing all specifications and documentation. For semantic searches, cross-document queries, or quick lookups across `docs/` and `specs/`, you can use `search_project_knowledge` or `ask_project_knowledge` as an alternative to reading files directly.

When the spec and any other doc disagree, the spec wins. When two spec sections appear to disagree, Appendix A (catalog promotion) is canonical for that subsystem.

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
9. **Encryption scope is narrow:** AES-GCM (KMS envelope) only on free-text notes, household invite tokens, exported-report URLs, contact names for splitting. Never amounts, merchants, products, categories, dates. (§7.5)
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
