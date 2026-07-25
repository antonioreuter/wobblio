# 07 — Ingestion latency & processing UX (living handoff)

The capture→parsed loop is the core of the product, and today it is slow **and** silent: median
end-to-end is ~17.5s while the webapp stops polling at 9s and tells the user it "usually takes a
few seconds". This epic attacks both sides — shave real seconds off the worker, and make the wait
feel alive on every client (stage-accurate progress, terminal state landing without a refresh).

Each sub-spec is independently shippable; implement one at a time and update this tracker.

| Sub-spec | Status | Notes |
|---|---|---|
| 01 — Processing progress backend (stage writes + status endpoint) | ✅ Shipped + verified on dev 2026-07-25 | `invoice_processing_progress` (RLS, cascade from invoice AND app_user), `IProcessingProgress` + pool-bound adapter (own short tx; worker pool max:1→2), stage flips in ExtractionPreparer (READING) and InvoiceCoordinator (MATCHING/FINALIZING), `processingStage` on `GET /invoices`, new `GET /invoices/status?ids=` (cap 10, UUID-validated). **Deviation from spec:** RECEIVED is substituted at read time via `COALESCE(p.stage,'RECEIVED')` instead of being INSERTed in ConfirmService — same client-visible result, no extra write or failure mode on the presign/confirm path. **Known gap:** the progress table carries only `tenant_isolation`, no household read policy, so a household member watching another member's in-flight invoice sees RECEIVED throughout instead of live stages (graceful, matches the clients' fallback). Live dev run: RECEIVED→READING(t+2s)→MATCHING(t+22s)→PARSED(t+27s), FINALIZING confirmed in-table (sub-second window) |
| 02 — Webapp live processing UX (poll-until-terminal + progress) | ✅ Built + review-hardened 2026-07-06 (client side) | Poll-until-terminal, terminal toast + usage/budget refresh, stage-label rendering ready (falls back to generic until 01), honest ~20s copy. Interim: polls full `GET /invoices` per tick; switch to `/invoices/status?ids=` when 01 lands (`TODO(specs/fixes/07.01)` in workspace-provider). Review fixes: toast branches on new `Invoice.rawStatus` (not display tone) so an unmapped status is never mis-announced as a failure; `waitUntilVisible` takes an `AbortSignal` (cleanup aborts) to avoid a leaked visibilitychange listener; `.toast-msg` gets tabular-nums |
| 03 — Mobile live processing UX (stage display + cheaper polling) | ✅ Built + review-hardened 2026-07-06 (client side) | Hold interval 9s→5s, terminal-transition ready/failed snackbar notice, stage-label rendering ready (`processingStage` parsed, null-safe). Interim: still full-list polling until 01. Review fixes: `_readyNotice` branches on raw status (DISCARDED/unknown → no misleading toast); `DashboardState.noticeSeq` token so two same-text "Receipt ready" notices both fire the snackbar (`listenWhen` compares seq); `processingStage` now carried on `InvoiceDetail` + parser so detail/review match the list |
| 04 — Worker latency quick wins (parallel Bedrock, init hoisting, prompt restructure) | 🟨 §§1–3 shipped 2026-07-25 · §4 deferred | §1 embeddings now run in a bounded-concurrency Bedrock phase ahead of the still-serial pg phase; §2 expansion chunks run under one `Promise.all` (order comes from chunk position, not arrival); §3 the model registry is module-scoped with a 5-min TTL and its reads are `Promise.all`'d. **§4 deferred — see below.** |
| 05 — Vision latency study (detached, decision-gated) | ⬜ GATED — needs explicit go | Extends 06.01 harness |

### Corrections to this epic's original assumptions (found 2026-07-24 while implementing)

- **04 §3 was partly written against a codebase that no longer existed.** `buildPool` is already a
  module-scope singleton (`db.ts`), so no pool was ever "rebuilt per invocation"; fix 11 had already
  module-cached the escalation thresholds. The real cost was different and larger than described:
  **six** sequential SSM reads (not five) on a `SsmModelRegistryAdapter` constructed fresh every
  invocation, so its cache never survived. Shipped fix = module-scope the instance + TTL + parallel.
- **The TTL is a behaviour change, not just an optimisation.** Before, a live SSM model swap took
  effect on the *next invocation* (because the adapter was rebuilt each time). Now it takes effect
  within 5 minutes on every warm container. That is the trade for not paying six SSM round-trips per
  message; the admin model-swap matrix depends on the bound, so don't raise it casually.
- **04 §4's "prereq" is recoverable, not missing.** `CachingBedrockConverseAdapter` and the port's
  `cacheReadInputTokens`/`cacheWriteInputTokens` fields *were* merged (`efbd9d63`) and then deleted
  in `70a9cd44` (legacy-pipeline decommission) as collateral — only the offline benchmark used them.
  `feature/vision-cost-cache-benchmark` is fully contained in main (0 unique commits) and is a stale
  pointer, not a source of unmerged work. Restore with `git show 70a9cd44^:<path>`, don't re-implement.
- **§4 is one unit of work, not two.** The adapter caches the *system* prompt only, so it buys
  nothing until the static taxonomy/tag block moves out of the user message (the version bump). Both
  halves also need a quality-drift check, which is why §4 is left as its own gated decision.
- **The measured baseline predates fix 11.** Adaptive escalation can add a second vision pass, so
  "p50 ≤ 14s" cannot be validated against the numbers below without re-measuring first.

## Measured baseline (dev, CloudWatch Logs Insights, 30d window ending 2026-07-06, n=12–15)

| Segment | avg | p90 | Notes |
|---|---|---|---|
| **End-to-end (SQS sent → done)** | **17.9s** | **20.6–25.4s** | p50 ≈ 17.4s; identical for PARSED and NEEDS_REVIEW |
| Queue wait (sent → worker start) | 1.3s | 1.5s | SQS + Lambda pickup; acceptable, not a lever |
| VISION_PARSE (qwen3-vl-235b) | **10.3s** | 15.6s | in 5.3k tok, out 514 tok — decode-speed bound |
| PRODUCT_NORMALIZATION stage | 4.3s | 7.7s | = Haiku PRODUCT_EXPANSION 3.8s avg + ~8 serial 124ms embeddings + pg |
| MERCHANT_RESOLUTION | 0.6s | 1.1s | Haiku fallback 0.9s when it fires |
| INVOICE_CLASSIFICATION + TAG_GENERATION | ~0s | — | deterministic paths dominate |
| VISION_PARSE_FALLBACK (sonnet-4-6) | 4.9s | 5.0s | n=3 — same parse ~2× faster than Qwen, but 4.3× cost (06.01) |

Reproduce: Logs Insights on `/aws/lambda/wobblio-agentic-worker-dev`, filters
`msg = "ingestion timing"` (totalMs/workerMs/queueWaitMs by status), `event = "agentic_stage"`
(durationMs by stage), `event = "bedrock_usage"` (durationMs/tokens by stage+modelId).

## Targets

- **Perceived:** processing row appears instantly (already true), stage-accurate progress visible
  within ~2s of upload, terminal state lands on screen without any user action on **both** clients.
- **Real latency after 04:** p50 ≤ 14s, p90 ≤ 20s (saves ~2.5–4s: parallel embeddings ~0.8s,
  parallel expansion chunks up to 3.8s on >20-line receipts, init hoisting ~0.3–0.5s, expansion
  prompt restructure ~0.2–0.4s).
- **If 05's study wins and the user approves a model change:** p50 ≤ 9s becomes reachable — vision
  is 60% of wall time and no code-level fix touches it.

## Decisions of record

- **Transport = polling, not WebSocket/SSE/AppSync.** At the capacity envelope (~3k ingestions/day,
  ≤25 API Lambda concurrency, db.t3.micro) an in-flight invoice polled every 2s for ~20s is ~10
  single-row indexed reads — trivial. A WebSocket API adds a new stack, connection table, and
  fan-out code to save those reads. Mobile background delivery is already covered by 16f push.
  Revisit only if the envelope changes.
- **Progress writes bypass the unified transaction by design.** The worker's pipeline runs inside
  ONE transaction (ingestionWorkerShell: BEGIN → process → charge → telemetry → COMMIT), so stage
  flips written on that client would be invisible until commit. 01 uses a second, short-lived
  autocommit-style transaction path (see 01 for the connection-budget math). Stage progress is
  best-effort telemetry for humans — it must never affect ingestion outcome (same rule as
  `IAgenticStageInstrumentation`).
- **Separate `invoice_processing_progress` table, not a column on `invoice`.** The main transaction
  UPDATEs the invoice row at finalize and holds the row lock until COMMIT; a progress write to the
  same row can block behind it. A separate row never contends.
- **Qwen stays the primary vision model** (06.01 decision of record: Sonnet+cache is 4.3× cost,
  fallback/PDF tier only; Nova eval explicitly deferred by the user). Sub-spec 05 is a *latency*
  study and is **gated on an explicit user go** — do not start it as part of "implementing this
  epic".
- **Honest copy:** clients say "usually takes about 20 seconds", never "a few seconds", until
  measured p50 says otherwise. Freshness-honesty is a webapp hard rule; apply it to time too.

## Invariants & rules touched

- New table is tenant-scoped → RLS + `SET LOCAL app.current_tenant_id` (invariant #1), included in
  the GDPR delete cascade, `npm run validate:security` after the migration (gdpr-privacy-officer).
- Hexagonal: progress is a new port (`IProcessingProgress`), core never sees pg/SQS.
- E2E: poll-until-terminal loops with backoff, `data-testid`, per-test tenant seeding
  (e2e-testing-coordinator) — the webapp change finally makes the app itself follow the same rule
  its tests do.
