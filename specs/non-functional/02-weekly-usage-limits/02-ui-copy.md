# 02 — UI Copy

**Non-Functional 02 · Phase 4/5 · "invoices/scans" → "credits"**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) §7 · Index: [README](./README.md)

## Overview

Mechanical text/format edits unifying terminology on **credits** with thousands separators. No logic
beyond the dashboard warning threshold. Depends on 01 (counters/`/me/usage` already credit-shaped).

## Files & changes

- `Source/webapp/src/components/ui/top-bar/top-bar.tsx` — label "Credits this week"; tooltip "Usage credits
  consumed this week"; `usageUsed.toLocaleString()` / `usageLimit.toLocaleString()`.
- `Source/webapp/src/app/(app)/dashboard/page.tsx` — `label="Credits Remaining"`; suffix " credits left";
  delta `${used.toLocaleString()} of ${cap.toLocaleString()} credits used this week`; warning tone at
  `(remaining ?? 0) <= 30000`.
- `Source/webapp/src/lib/upload-receipt.ts` — 429 → "You've reached your weekly usage credit limit."
- `Source/webapp/src/components/marketing/landing-page-view.tsx` — Standard "30,000 weekly credits
  (~3 receipt scans)", Premium "100,000 weekly credits (~10 scans)", Household "150,000 weekly credits
  pooled (~15 scans)". **Fix stale "up to 5 members" → 3** (`MAX_HOUSEHOLD_MEMBERS`).
- `Source/admin/src/app/(console)/users/users-section.tsx` — ±10000 deltas; tooltips "Add/Remove 10,000
  credits"; dialog "Adjust weekly credits?"; quota display `.toLocaleString()`; update comment.

`Usage` interface (`workspace-provider.tsx`) already credit-agnostic (`used/cap/remaining/unlimited`).

> Consider [open decision #5] scans-first display ("≈7 of 10 scans left" primary, credits secondary)
> before finalizing the dashboard/top-bar copy — a product call.

## Checklist

- [x] top-bar label/tooltip/format
- [x] dashboard label/suffix/delta/threshold (30000)
- [x] upload-receipt 429 message
- [x] landing-page Standard/Premium/Household copy + members 5→3
- [x] admin users-section deltas/tooltips/dialog/format/comment

**Done (2026-06-28).** Beyond the spec's file list, also fixed stale quota copy that no later sub-spec
owns (04 covers pool logic + `/me/usage` flip, not copy): "up to 5 members"→3 in
`create-household-dialog.tsx` + `invite-panel.tsx`, and `household/page.tsx:114` "15 extra uploads … personal
scans" → "150,000 extra weekly credits (~15 scans) … personal credits". Left the conceptual "upload pool"
naming alone (branding, not a unit claim). Display stays credits-first (open decision #5 deferred per user).
Dashboard `usage.cap` guarded with `?? 0` before `.toLocaleString()` (`cap: number | null`).
**Deviation from spec:** dashboard warning threshold is `<= 10000` (~1 scan left), **not** the spec's
`30000` — `30000` equals the STANDARD cap (`3 × 10000`) so `remaining <= 30000` was always true, pinning
the free-tier card permanently amber. `10000` warns at ~1 scan remaining across tiers. Unlimited-branch
delta also gained the word "credits" for consistency.
Validation: webapp `tsc` clean + 107 unit tests pass; admin `tsc` clean + 21 pass.
