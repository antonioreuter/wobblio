# 11 — Adaptive vision-model escalation (living handoff)

Large, degraded receipts parse wrong on the single fixed vision model (Qwen3-VL) and silently reach the user as `NEEDS_REVIEW` — or worse, `PARSED` — with fabricated line data. The proven case: a 69-item Estância Supermercados receipt (dev invoice `b9c03d9e…`, R$848.61) where Qwen collapsed every fractional-kg weight quantity to `1.000`, copied unit prices into line totals, garbled names, and **self-reported 0.92 confidence on the wrong result across 3 runs**. This family adds a two-part quality path: a **pre-model deterministic capture gate** (retake bad photos before spending any AI), then a **confidence-driven escalation ladder** (Qwen → Sonnet → Opus) so hard-but-legible receipts get a stronger model instead of landing in review. All models and thresholds are **SSM-configurable**; the core stays SDK-free behind ports.

---

## Root cause (two coupled gaps)

**Gap A — no capture-quality gate.** Bad photos (blur, glare, cut-off edges, extreme skew) are only caught *after* a full vision call returns a `BLURRY` / `NOT_A_RECEIPT` unreadable verdict (`Source/backend/src/core/domain/failureReasons.ts`), which is **charged** to the user and gives thin guidance. Degraded-but-legible receipts (folded, faded, 60+ items) never trip that verdict at all — they parse *wrong* and hit `NEEDS_REVIEW`.

**Gap B — one fixed vision model, no escalation.** The worker resolves exactly one model — `vision_parser` (`qwen.qwen3-vl-235b-a22b`) — from SSM and has no path to a stronger model when the parse is low quality. `vision_fallback` (= `eu.anthropic.claude-sonnet-4-6`) already exists in SSM but nothing consumes it. Measured on the Estância receipt (3 runs each, same v9 prompt, model swapped only):

| Model | Total | Line coverage | Σ reconciles? | Self-confidence |
|---|---|---|---|---|
| Qwen3-VL (current) | 846.84 ✗ | 62 (fabricates) | never (899–1109) | 0.92 (overconfident ✗) |
| Sonnet-4-6 | 848.61 ✓ | 54 (drops top block) | never (~786) | 0.52 (honest) |
| Opus-4-6 | 848.81 ✓ | 58–60 (best coverage, keeps codes) | never (~800) | 0.32 (most calibrated) |

Fidelity+honesty ranking: **Opus ≳ Sonnet > Qwen**. None fully reconciles this *degraded* image (that's Gap A's job), but the stronger models get the header right and — critically — report *honest* confidence, which is what makes a confidence ladder viable. Qwen's stuck 0.92 is why routing on **raw** self-confidence would fail; see the blended-score decision below.

---

## The fix, in one paragraph

Before any AI, run a **deterministic capture gate** (blur / glare / framing / skew, on-device on mobile and a lighter mirror in the webapp uploader); on fail, block upload and return specific retake instructions — no AI, no credit. On pass, parse on the **primary** model (Qwen, the traditional path) as today. Compute a **blended quality score** from the parse (model-reported confidence, improved by a new prompt v10, **plus** objective reconciliation residual **plus** line-coverage vs the printed item count). Route on that score through an SSM-configured threshold ladder: high → accept; mid → re-parse on `vision_fallback` (Sonnet); low → re-parse on `vision_fallback_deep` (Opus, preferably 4.8). The escalated result replaces the primary and passes the normal `PARSED` / `NEEDS_REVIEW` gate. Every model id and every threshold lives in SSM (`/wobblio/config/<stage>/…`), swappable live; no ids or cutoffs hardcoded in core.

---

## Target flow

```
[capture gate: blur/glare/framing/skew]  ──fail──▶  retake + instructions  (no AI, no credit)
        │ pass
        ▼
   Qwen  (vision_parser — traditional path, always first)
        │
   quality score = f(model_confidence_v10, reconciliation_residual, coverage_ratio)
        │
   ├─ score ≥ ACCEPT_MIN ........................▶ accept (PARSED / NEEDS_REVIEW as today)
   ├─ DEEP_MAX ≤ score < ACCEPT_MIN ── re-parse ▶ Sonnet  (vision_fallback)      ─┐
   └─ score < DEEP_MAX ─────────────── re-parse ▶ Opus    (vision_fallback_deep) ─┤
                                                                                  ▼
                                               escalated result → normal PARSED / NEEDS_REVIEW gate
```

One escalation hop, tier chosen by the primary score (not a step-by-step cascade). Skipping Sonnet straight to Opus on very-low scores is deliberate — the band picks the tier.

---

## SSM configuration (the part the user pinned)

Models — existing `/wobblio/config/<stage>/models/<role>` pattern:

| Role | dev value | Notes |
|---|---|---|
| `vision_parser` | `qwen.qwen3-vl-235b-a22b` | primary, exists |
| `vision_fallback` | `eu.anthropic.claude-sonnet-4-6` | mid tier, exists (currently unused) |
| `vision_fallback_deep` | `eu.anthropic.claude-opus-4-6-v1` | **NEW** low-score tier — SSM-swappable to `claude-opus-4-8` once access is granted |

Thresholds — new `/wobblio/config/<stage>/ingestion/vision_escalation` (JSON or discrete params), starting defaults (tune from telemetry):

| Key | default | meaning |
|---|---|---|
| `accept_min` | `0.88` | score ≥ → keep primary (tuned from the v9-vs-v10 sweep: clean ~0.97, degraded 0.85) |
| `deep_max` | `0.55` | score < → Opus; in `[0.55, 0.85)` → Sonnet |
| `capture_gate.blur_min` | tbd | Laplacian-variance floor |
| `capture_gate.enabled` | `true` | kill-switch |

Escalation itself gated by `enabled` so the whole ladder can be turned off live. `estimateCostUsd` is stage-priced (not model-priced) — the escalation's real $ premium lands on the operator, not the user's token-based credit; see credit decision below.

---

## Sub-specs

| # | File | Blocks | Status |
|---|------|--------|--------|
| 01 | `01-vision-prompt-v10-calibrated-confidence.md` | — | **DONE + swept** — v10/v10c prompt + `stated_item_count` + Σqty coverage. Sweep: v10 rubric widens correct−wrong conf gap 0.05→~0.12 (clean ~0.97, degraded 0.85), no accuracy regression → **KEPT**; `acceptMin` tuned 0.85→0.88. |
| 02 | `02-blended-quality-score-and-escalation-domain.md` | 01 | **DONE** — domain + 10 unit tests |
| 03 | `03-ssm-config-and-model-role-wiring.md` | — | **DONE (code)** — `ModelRole`+rate+catalog+deep stage; `IEscalationConfig`/`SsmEscalationConfigAdapter`. Worker IAM already covers `inference-profile/*` (no change). Remaining: **provision** SSM params (see activation). |
| 04 | `04-worker-escalation-integration.md` | 02, 03 | **DONE (code)** — two-tier `EscalatingReceiptParser` + `decideReceiptEscalation` wired in the worker; `event: vision_escalation` logging; full suite green (1032 tests) |
| 05 | `05-capture-quality-gate-and-retake-instructions.md` | — | **DONE (webapp + mobile + Layer C + dialog)** — webapp `image-quality.ts` gate; **mobile** `image_quality.dart` gate (dart:ui decode, retake bottom-sheet, force override); **Layer C** server-side `RETAKE_SUGGESTED` (no-charge); designed retake **dialog** replaced `window.confirm`. Long-receipt multi-frame → scoping spec 07. |
| 06 | `06-credit-charging-and-telemetry.md` | 04 | **DONE** — charging unchanged (worker shares one metered converse across all tiers → both parses billed, decision 2). `VisionEscalationRollupService` + `CloudWatchLogsVisionEscalationAdapter` roll `vision_escalation` logs into `kpi_daily` (`vision_escalation_count` by tier+reason, `_used_count`/`_errored_count` by tier), wired into the daily rollup cron. |
| 07 | `07-multi-frame-capture.md` | — | **SCOPING ONLY** — concrete build plan for long-receipt segmented capture + N-image ingest; flags the idempotency/#7 + §6.8-dedup rewrite. Not implemented; needs its own approval + a measured vision-model multi-image check. |

## DAG

```
01 (prompt v10) ─→ 02 (score + escalation domain) ─┐
03 (SSM + model roles) ────────────────────────────┼─→ 04 (worker integration) ─→ 06 (credits + telemetry)
05 (capture gate) ── independent; ships anytime ────┘
```

01→02→04 is the escalation spine. 03 (config + IAM + `ModelRole` type) can land first and unblocks 04. 05 (capture gate) is independent and is the highest-ROI standalone win — it is the only part that would have caught the Estância receipt (the escalation ladder raises the ceiling on legible-hard receipts, not degraded ones).

---

## Decisions (confirmed 2026-07-15)

1. **Routing score = blended, not raw model confidence (CONFIRMED).** Qwen self-reports 0.92 on garbage; raw self-confidence would never escalate the very receipts we care about. Blend model confidence (v10) with reconciliation residual and coverage ratio so the threshold ladder is trustworthy. Sub-spec 02 owns the formula.
2. **Credit charging = actual tokens, both parses (CONFIRMED).** No change to the `chargeIngestion` mechanic — a double-parse bills ≈ 2× tokens. **New requirement:** emit explicit escalation logs (`event: vision_escalation`: from/to model, primary blended score, band, both-parse token totals) so escalation frequency and cost are monitorable and the app can be tuned/improved from real data. Sub-spec 06 owns this.
3. **Prompt v10 must be measured, not assumed.** Calibration improvement is validated via the eval harness (`compare-vision-models.ts` / `eval:country-prompt`) before v10 is promoted — a better *number* is worthless if it isn't better *calibrated*.

## Open action item

- **Opus model id is SSM config, not code.** Deep tier ships pointed at `eu.anthropic.claude-opus-4-6-v1` (access-granted in dev today). 4.7/4.8 currently return `AccessDenied`; swap `vision_fallback_deep` to `claude-opus-4-8` via a single SSM parameter edit once access is enabled — no redeploy, no code change. This configurability is the invariant; the specific id is not.

---

## Blast radius (what does NOT change)

- **Ingestion order & idempotency (§6, invariant #7):** capture gate sits *before* presign-confirm / the worker; escalation is inside the existing vision-parse stage (step 3), re-invoking the same `VisionParseService` with a different model id. Ledger, dedup, tenant-write order untouched.
- **Price Observation Store (invariant #2):** unaffected — escalation changes *which model reads the receipt*, not what/whether observations emit.
- **`VisionParseService` contract:** already takes `(converse, modelId, promptSelector, stage)` — escalation constructs a second instance with the fallback id and `VISION_PARSE_FALLBACK` stage. No signature change.
- **Existing `BLURRY` / `NOT_A_RECEIPT` verdict path:** stays; the capture gate is an additional, earlier, cheaper gate, not a replacement.
- **Hexagonal boundary:** score/threshold/escalation logic is pure domain; model ids and SSM reads stay in adapters/config. Validator must stay exit 0.

## Sync points (change all or parity/validators fail)

1. New `vision_fallback_deep` role ⇄ `ModelRole` union/`Record<ModelRole>` literals ⇄ worker Bedrock `InvokeModel` IAM (new Opus inference-profile ARN) ⇄ manual dev/prod SSM provisioning. (Model Role Addition Checklist — historically drifts 3 spots.)
2. Prompt v10 ⇄ `prompt_version` recorded in `invoice_feedback.model_ids_snapshot` ⇄ schema validator (if the output schema gains a `legibility` / `linesUncertain` field).
3. Escalation telemetry (`event: bedrock_usage` per tier + a new `event: vision_escalation` with from/to model + score) ⇄ `kpi_daily` rollup Logs Insights query.

---

## Where this stands

2026-07-15: Sub-spec 02 (the escalation brain) implemented + green — `src/core/domain/visionEscalation.ts` (blended `min(confidence, reconciliation, coverage)` → tier) with 10 unit tests; `tsc` exit 0; hexagonal validator clean. Type-level model-role wiring done (`MODEL_ROLES` gained `vision_fallback_deep`; `aiSpend.RATE_PER_1K` + `modelCatalog.MODEL_OPTIONS` extended, Opus-priced). Nothing is wired into the worker yet — escalation does not run in the pipeline until 04. Evidence + measurements in memory `project_sonnet_fallback_large_receipt_test`; dev helper `Source/backend/src/local/compare-vision-models.ts` (`ONLY_MODEL=qwen|sonnet|opus`) reproduces the benchmark.

2026-07-15 (cont.): Sub-specs 03+04 implemented + green. The escalation ladder is wired into the agentic worker: primary Qwen → `decideReceiptEscalation` (blended score, `min(confidence, reconciliation, coverage)` + BLURRY/multi-buy floors) → re-parse on `vision_fallback` (Sonnet, mid) or `vision_fallback_deep` (Opus, deep), single hop, deep→mid→primary fail-open. Thresholds via `SsmEscalationConfigAdapter` (`/wobblio/config/<stage>/ingestion/vision_escalation`, fail-open to defaults). Charging unchanged (both parses' tokens metered → billed, per decision 2). `event: vision_escalation` logs `{tier, ranTier, reason, score{blended,…}, usedFallback, fallbackErrored}` for monitoring. `tsc` 0 · hexagonal clean · **1032/1032 unit tests**.

### Activation (deploy-time; not done — do not deploy unprompted)
1. Deploy the worker (`WobblioDataAiPipelineStack`).
2. Provision SSM `/wobblio/config/dev/models/vision_fallback_deep = eu.anthropic.claude-opus-4-6-v1` (manual, like other model ids). `vision_fallback` (Sonnet) already exists → **mid-tier escalates today once deployed**; deep needs this one param.
3. Optional: SSM `/wobblio/config/dev/ingestion/vision_escalation = {"acceptMin":0.85,"deepMax":0.55,"reconciliationTolerancePct":0.02}` — omit to use built-in defaults.
4. IAM: none — worker already holds `bedrock:InvokeModel` on `inference-profile/*`.

2026-07-17: 01 swept + KEPT (see 01 status). 2026-07-18: **05 webapp capture gate** implemented — `image-quality.ts` (Laplacian-blur / glare / dark, conservative defaults) gates `prepareImage` with a `force` override and retake copy; `low_quality` → retake-or-upload-anyway in `workspace-provider`. Webapp 180/180 tests, tsc 0.

2026-07-18 (cont.): **06, Layer C, mobile gate, and the retake dialog all implemented + green** (uncommitted). Remaining fix-11 work is now only the deferred multi-frame track, captured as scoping spec 07.
- **06 (escalation telemetry):** `IVisionEscalationSource` + `visionEscalationKpi.toVisionEscalationRows` + `VisionEscalationRollupService` + `CloudWatchLogsVisionEscalationAdapter`, wired into `cron-ingestion-metrics-rollup`. Rolls `vision_escalation` logs → `kpi_daily`. Charging confirmed unchanged (both parses metered via the shared converse). Backend 1051 unit tests, hexagonal + security validators clean.
- **Layer C (server-side retake):** new `RETAKE_SUGGESTED` invoice status (migration `20260718120000`, `ALTER TYPE … ADD VALUE`, noTransaction) + `RETAKE_LOW_QUALITY` reason. `isRetakeSuggested(receipt, thresholds)` fires in `ExtractionPreparer` for **photo** parses in **escalation-enabled** deployments only, short-circuiting before canonicalization. Push + webapp + mobile status maps render "Retake needed" (amber). **Calibrated after the high-effort review (see below):** retake fires ONLY on a gross reconciliation failure (`residual ≥ retakeResidualPct`, default 0.15) — never on a receipt the arithmetic path would keep (≤1% PARSED) or one that's correctable in review (1–15% → NEEDS_REVIEW); confidence and coverage are not triggers. Charging (`shouldChargeIngestion`) is free only for a **primary-only** retake; a retake that escalated to Sonnet/Opus is charged the actual tokens (closes the free-premium-model abuse vector).
- **Mobile capture gate:** `core/domain/image_quality.dart` (pure mirror of the webapp) + adapter decodes a downscaled RGBA sample via `dart:ui` and gates `prepareImage(raw, {force})`; `UploadErrorCode.lowQuality` → `CaptureLowQuality` state → retake / upload-anyway bottom-sheet (no re-capture; holds the bytes). 190 mobile tests, analyze clean.
- **Retake dialog:** `RetakeDialog` (designed modal, `confirm-*` classes) replaced `window.confirm` in `workspace-provider`. 183 webapp tests.

2026-07-18 (review remediation): a high-effort multi-agent code review of the above surfaced 10 defects, all fixed (backend 1056 unit ✓, hexagonal + security ✓, infra tsc ✓, mobile 25 ✓):
- **① abuse vector** — an uncharged RETAKE_SUGGESTED could run (and never bill) an Opus escalation. Fix: `shouldChargeIngestion` now charges a retake that escalated (meter shows a `VISION_PARSE_FALLBACK*` stage ran); only a primary-only retake is free.
- **②④ retake over-fired** — reused the escalation `deepMax` band, discarding correctable/PARSED-worthy receipts at ~1% residual and on a stated-count misread. Fix: dedicated `retakeResidualPct` (0.15); retake only on gross reconciliation failure, never when `isArithmeticConsistent`; coverage dropped as a trigger.
- **③ fail-open broken** — retake fired even in a Qwen-only config. Fix: `ExtractionPreparer` gets `escalationEnabled`; the gate is inert without a fallback tier (identical to today).
- **⑤⑥ IAM drift** — `vision_fallback_deep` added to the api-handler SSM models allowlist (`WobblioBackendStack`); `ingestion/*` added to the worker SSM grant (`WobblioDataAiPipelineStack`) so escalation thresholds actually load.
- **⑦** `EscalatingReceiptParser` now upgrades a MID decision to the deep tier when only deep is provisioned; **⑧** escalation-config memo moved to module scope (was dead); **⑨** mobile gate sample bumped 400→1000px to match the webapp's assessed scale (was false-flagging sharp photos); **⑩** stale 0.85 acceptMin docs corrected to 0.88.

Next: **deploy + provision** to activate the ladder (worker deploy + SSM `vision_fallback_deep` — see Activation above; nothing committed or deployed yet), or greenlight **07 multi-frame** (resolve its §7 decisions + measure the vision model's multi-image support first). Deploy is user-gated; do not deploy unprompted.
