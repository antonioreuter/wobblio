# 07 — Long-receipt multi-frame capture (scoping spec)

**Status: SCOPING ONLY — not implemented.** This is the concrete build plan + decision list for the one deferred track of sub-spec 05. Nothing here is wired; it needs the decisions in §7 resolved and its own approval before code lands.

The escalation ladder (02–04) raises the ceiling on *legible-but-hard* receipts; the capture gate (05) blocks a *degraded* single frame. Neither fixes the actual failure mode behind the proven Estância case: a **69-item thermal receipt is physically too long to photograph legibly in one frame**. Folded to fit, the fold-lines garble text; laid out and shot from far enough to fit, the type is too small to resolve. The capture gate correctly says "retake in sections" — this spec is what "in sections" *does*: capture N overlapping frames, ingest them as **one** invoice, parse them into one reconciled receipt.

This is a genuine capture-UX + ingestion-model build, not a warning string. It touches the one-image-per-invoice assumption that idempotency, dedup, and presign are all built on (invariant #7, §6.8), so it is scoped separately and deliberately.

---

## What changes vs today

Today's path is **one image → one `s3Key` → one `ingestion_ledger` claim → one presigned PUT → one vision-parse call → one invoice**. Multi-frame breaks the 1:1 at every layer:

| Layer | Today (1:1) | Multi-frame (N:1) |
|---|---|---|
| Capture UX | single shutter → prepare → upload | segmented capture (frame 1…N, overlap guidance, per-segment retake, stitch preview) |
| Presign | one presigned POST per invoice | N presigned POSTs under one invoice id |
| S3 layout | `receipts/<tenant>/<hash>.jpg` | `receipts/<tenant>/<invoiceId>/<seq>.jpg` (segment-addressed) |
| Idempotency (#7) | ledger claim keyed by `s3Key` | one claim per invoice covering all segments; a redelivery must still short-circuit |
| Dedup (§6.8 Layer 1a) | SHA-256 of the one image | dedup the **set** (canonical composite hash), not each frame |
| Vision parse | one image block | N image blocks in one Converse call, **or** per-frame parse + line-stitch |
| Reconciliation | Σ lines vs printed total | Σ across all segments vs total; **cross-boundary de-duplication of lines** |
| Charging | tokens of one parse (+ escalation) | tokens across all frames in one charge |

---

## Recommended approach (single call, segment-addressed, set-hashed)

Two viable parse strategies; recommendation first:

- **A — single multi-image Converse call (RECOMMENDED).** Send all N frames as ordered image blocks in one vision call; the model reads them as one continuous receipt. Pros: the model resolves cross-boundary continuation itself (a line split across two frames), no brittle stitch heuristic, one confidence + one reconciliation. Cons: token cost scales with N images; must confirm the vision model accepts multiple image blocks (Qwen3-VL: verify block limit; the Sonnet/Opus escalation tiers already accept multi-image). Overlap between frames risks double-counting → the prompt must instruct "these are overlapping sections of ONE receipt; do not repeat lines visible in two frames."
- **B — per-frame parse + deterministic stitch.** Parse each frame independently, then merge line lists dropping the overlap. Pros: bounded per-call cost, reuses the existing single-image path. Cons: a real stitch algorithm (align on overlapping lines, resolve conflicts, renumber `line_index`) — exactly the kind of heuristic that fails on the degraded receipts we care about; two frames that each misread the shared overlap can't be reconciled. Rejected as primary; keep as fallback only if A hits a block-count/token ceiling.

Everything below assumes **A**.

---

## Target flow

```
[segmented capture: frame 1 … frame N, overlap-guided]     (client, webapp + mobile)
        │  each frame runs the 05 capture-quality gate individually (retake a bad segment, not the whole set)
        ▼
   presign(invoiceId, segmentCount)  → N presigned POSTs      (one invoice row, PROCESSING)
        │  client PUTs each frame to receipts/<tenant>/<invoiceId>/<seq>.jpg
        ▼
   confirm(invoiceId)                → enqueue ONE ingestion message { invoiceId, segmentKeys[] }
        │
   worker: ledger.claim(invoiceId)  (one claim; redelivery short-circuits)
        │  dedup: composite hash of the ordered frame set vs same-tenant history (§6.8)
        ▼
   vision parse: ordered image blocks → one ParsedReceipt (escalation ladder unchanged, applies to the whole set)
        │
   reconcile Σ lines vs printed total  →  PARSED / NEEDS_REVIEW / RETAKE_SUGGESTED (Layer C) as today
```

The escalation ladder (04) and Layer C retake (this family) sit **downstream unchanged** — they operate on the single `ParsedReceipt` the multi-image call returns, so they compose for free. A multi-frame parse that still doesn't reconcile is a Layer-C `RETAKE_SUGGESTED` ("retake the sections with more overlap"), and the ladder still escalates a low-quality multi-image parse to Sonnet/Opus.

---

## Invariants touched (the reason this is separate)

1. **#7 Idempotency-first ingestion.** The ledger's first-write `INSERT … ON CONFLICT DO NOTHING` is keyed on the upload identity. Moving from `s3Key` to `invoiceId` as the claim key must preserve exactly-once: a redelivered SQS message re-claims the same invoice and short-circuits. **Decision needed:** claim key = `invoiceId` (see §7.1).
2. **§6.8 Layer 1a cross-tenant dedup + same-tenant SHA reject.** Presign-confirm rejects same-tenant duplicate *hashes* at zero AI cost. With N frames there is no single hash. Define a **canonical composite hash** = hash of the ordered per-frame SHA-256 list, and dedup on that. Consequence: re-uploading the *same* multi-frame set is rejected; re-uploading the same receipt captured with *different* framing is a fuzzy-duplicate caught post-parse (unchanged §6.8 Layer 2).
3. **Presign TTL ≤300s / bucket lockdown** (rule: serverless-iac-architect). N presigned POSTs, each ≤300s, same bucket policy. No change to the rule, only to the count.
4. **Charge-by-timing** (Non-Functional 02). One charge for the whole set = the metered tokens of the single multi-image call (+ escalation). No per-frame charging. The Layer-C no-charge carve-out still applies to the set.
5. **EXIF strip + ≤1MB/frame** (flutter-architecture-guard #4 / webapp #8). Applies **per frame** — each segment is stripped + compressed client-side before its PUT, unchanged from the single path.

Untouched: the Price Observation Store (#2 — emission is per parsed line, blind to how many frames produced them), RLS/tenant isolation (#1), the catalog/quorum pipeline (#8).

---

## Sub-spec breakdown (proposed, for when this is greenlit)

| # | File | Scope | Blocks |
|---|------|-------|--------|
| 07a | `…/07a-segmented-capture-ux.md` | webapp + mobile capture: frame-by-frame flow, overlap guidance, per-segment gate + retake, stitch/review preview before upload | — |
| 07b | `…/07b-multi-image-ingest-model.md` | presign N-segment, S3 segment-addressing, one-invoice ledger claim, composite-hash dedup, message shape `{ invoiceId, segmentKeys[] }` | — |
| 07c | `…/07c-multi-image-vision-parse.md` | ordered multi-image Converse call + prompt v11 "overlapping sections of one receipt", block-count/token guardrails, escalation composition | 07b |
| 07d | `…/07d-dedup-idempotency-proof.md` | integration proof: redelivery short-circuits, composite-hash reject, cross-boundary line de-dup, reconciliation across segments | 07b, 07c |

DAG: `07a` (client) is independent; `07b → 07c → 07d` is the ingest spine. Ship 07b+07c behind a `multi_frame_enabled` composition wiring (detached, per the "detached & removable" convention) so the single-frame path is untouched until proven.

---

## Open decisions (resolve before building)

1. **Max segments N.** A hard cap (proposed **4**) bounds token cost and the Qwen image-block limit. A 69-item receipt in ~3 frames is realistic. Cap enforced client-side + re-checked at presign.
2. **Vision-model multi-image support.** Confirm Qwen3-VL's per-call image-block limit and token behaviour on N images before committing to strategy A; if Qwen caps below N, either force multi-frame straight onto the Sonnet tier (cost) or fall back to strategy B. **Measure on the eval harness first** (per decision 3 of the handoff — never assume).
3. **Dedup granularity.** Composite hash rejects an identical re-upload of the set. Confirm this is the desired UX (vs allowing re-capture) with the same reasoning as the single-frame §6.8 reject.
4. **Partial-set failure.** If the client uploads 2 of 3 presigned segments then abandons, the invoice must time out of `PROCESSING` cleanly (reuse the existing quarantine/DLQ terminal-flip; a never-confirmed multi-upload is a stranded `PROCESSING` row — needs a sweep or a confirm-time completeness check).
5. **Charging a retaken segment.** Retaking one bad frame client-side before upload costs nothing (no model ran) — consistent with the single path. Confirmed: no special handling.

---

## Why not now

The other four fix-11 tracks (06 telemetry, Layer C retake, mobile gate, webapp dialog) are shipped and self-contained. Multi-frame is the highest-value *product* win for 60+ item receipts but the highest-*risk* engineering change in the family — it rewrites the ingestion identity model. It earns its own approval, its own measured vision-model check (open decision 2), and the detached wiring the codebase uses for anything that touches the core pipeline. This spec is the on-ramp; the build starts at 07b once decisions §7.1–§7.5 are answered.
