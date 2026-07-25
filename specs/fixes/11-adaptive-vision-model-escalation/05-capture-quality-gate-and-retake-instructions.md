# 05 — Capture-quality gate + retake instructions

The escalation ladder (02–04) raises the ceiling on *legible-but-hard* receipts; it cannot recover a *degraded* photo (folded/faded/blurry — the Estância case). This family catches a bad capture **before** any upload/AI/credit spend and tells the user how to fix it. Independent of the escalation spine.

## Layer A/B — webapp pre-upload gate (DONE 2026-07-18)

Deterministic, client-side, no AI, no network — runs on the canvas `prepareImage` already draws for EXIF-strip + compression, so it adds no round-trip.

- **`webapp/src/lib/image-quality.ts`** (pure, tested): `assessImageQuality(luminanceSource, thresholds)` → `{ ok, issues }` over three focus/exposure measures:
  - **BLURRY** — variance of the 4-neighbour Laplacian below `minSharpness` (standard focus measure).
  - **GLARE** — fraction of blown-out (luma ≥ 245) pixels above `maxBrightFraction`.
  - **TOO_DARK** — mean luminance below `minMeanLuminance`.
  - Defaults are conservative (bias to *not* flag; a false block is worse UX than a rare miss) and injectable for tuning. `qualityIssueMessage(issues)` renders the retake tip (Layer B copy), including "lay the receipt flat" (the framing failure pixels can't see) and the override offer.
- **Wiring** (`upload-receipt.ts`): the gate runs after `drawImage`; a failing verdict throws `UploadError('low_quality', tip)` **unless `force`**. Fail-open — if `getImageData` is unavailable it skips silently; PDFs are never gated.
- **UX** (`workspace-provider.tsx`): a `low_quality` error prompts retake-or-**upload-anyway** (`force`), never a hard block — so a false positive can't stop a real receipt.

Tests: `image-quality.test.ts` (8) + gate cases in `upload-receipt.test.ts` (reject / force-bypass / PDF-skip). Webapp suite 180/180, tsc 0.

## Deferred / follow-on

- **Long-receipt multi-frame capture** — the real fix for 60+ item receipts; a genuine capture-UX build (segmented capture + stitch/multi-image ingest), not a warning string. Own scoping.
- **Mobile (Flutter) capture gate** — mirror Layer A in `Source/mobile` capture (camera behind a port, per flutter-architecture-guard; blur/glare on-device). Parallel track, needs Dart.
- **Layer C — server-side objective-failure retake** — when a parse fails reconciliation / coverage (post-escalation), return an actionable "retake flat / in sections" distinct from the model's `BLURRY` verdict, and **do not charge** a retake caused by our parse failing. Reuses the escalation signals. Backend, separable.
- **Custom retake dialog** — the current override uses `window.confirm`; a designed modal (financial-grade personality) is a polish follow-up.

## Status

Webapp gate implemented + green 2026-07-18. Mobile + long-receipt + Layer C PENDING.
