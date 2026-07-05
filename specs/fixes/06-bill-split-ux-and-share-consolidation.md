# Fix 06 — Bill-split assignment UX + share consolidation

**Priority: P2.** **Tag:** [UX] (usability defect, no data corruption) · **DB migration:** none.
**Surfaces:** webapp (`bill-split-dialog.tsx`) + mobile (`split_bill_screen.dart`). Backend contract
(11b) is unchanged — this is a client-only redesign of two interaction points.

Owning epics: `specs/mvp/11-splitting-fx-reporting/11c-bill-splitting-web-ui.md` (web) and
`specs/mvp/18-mobile-navigation-and-lists/18h-split-bill.md` (mobile). Detail lives there; this
file is the shared brief so both surfaces stay in parity.

---

## Problem 1 — Sharing one item across two or more people is not discoverable

### What the user hit
> "The clicking part to add more than one user is not very intuitive, and I got myself lost in how
> many clicks I had done without getting the result I expected, especially when I had to add 2 or
> more people to split a single invoice item, with amount equal to 1."

### Root cause (both surfaces, same model)
A single-unit line (`quantity == 1`) is assigned by an **implicit two-part gesture**: pick an
*active participant* chip at the top, then tap the line to toggle **that one person** in or out of
the line's even split.

- Web: `toggleShare()` — `bill-split-dialog.tsx:164`. The tapped line adds/removes
  `activeParticipant`; the denominator is recomputed as "number of sharers".
- Mobile: `SplitBillLineTapped(line.id)` — `split_bill_screen.dart:434`, dispatched against the
  current `activeParticipant`.

To split one €X item across **Me + Alice + Bob** the user must: select *Alice* → tap line → select
*Bob* → tap line (You is folded in as the reconciled remainder). That is four actions across two
different UI regions, with **no on-line indication of who is currently sharing** while doing it, and
no direct "split this evenly among N people" control. The click count is invisible, so the user
loses the thread — exactly the reported symptom.

The mobile hint copy makes it worse: `"tap → ½ → ⅓"` (`split_bill_screen.dart:420`) reads as *"each
tap cycles the fraction"*, but a tap actually toggles the active person; the fraction is only a
side effect of how many people happen to be toggled in. Mental model mismatch.

### Goal
Make "who shares this line, and in how many equal parts" **directly visible and directly editable
on the line itself**, decoupled from the global active-participant selector and from counting taps.

### Proposed solution (recommended — inline per-line sharer toggles)
For single-unit lines, replace the active-participant-dependent tap with an **inline row of
selectable avatars** rendered on the line — one toggle per person (You + every named participant):

- Tapping an avatar toggles that person into/out of this line's even split. Selected avatars are
  filled/ringed; unselected are dimmed.
- The denominator is always exactly the number of selected avatars; badges update live
  (`½`, `⅓`, `¼`, …) using the existing `fractionLabel`/`shareLabel` helpers.
- "You" is a normal selectable avatar here (persisted as the reconciled remainder exactly as today —
  the `youSharedLineIds` tracking in `bill-split-dialog.tsx:70` stays; it just gets a visible
  toggle instead of being reachable only via the active-participant chip).
- Multi-unit lines (`quantity > 1`) keep the existing `+/−` stepper — that flow assigns *discrete
  units* to the active participant and is not the source of the confusion. The active-participant
  selector therefore remains, but only governs the stepper path.

This removes the hidden gesture: the user sees "Me, Alice, Bob" on the line and taps the two extra
faces once each. No re-selecting a chip, no counting, no ambiguous cycle hint.

Replace the misleading hints:
- Progress line copy → `"use +/− to assign quantities; tap the people on a single item to split it
  evenly"`.
- Drop `"tap → ½ → ⅓"`; the live badges are self-explanatory.

**Trade-off considered.** The lighter alternative — keep the active-participant tap model but add a
persistent "sharing: [avatars]" strip + a "Split evenly" button per line — is less code but keeps
two mental models (chip-select for single-unit, chip-select for multi-unit-plus-stepper) and still
routes single-unit sharing through the global selector. The inline-toggle approach is preferred
because it makes the single-unit case answerable without ever touching the top selector, which is
the specific thing the user got lost in. If inline avatars crowd the line at ≥5 participants,
overflow into a wrap row (mobile already uses `Wrap`; web `split-owners` can too).

### Acceptance criteria (Problem 1)
- On a `quantity == 1` line, a user can add a second and third sharer with **one tap per person**,
  with the running denominator visible the whole time. No dependency on the active-participant chip.
- Removing a sharer is one tap on the same avatar; badges and the per-person summary reconcile.
- Σ of all persons' shares === line total (You absorbs the remainder — invariant unchanged; still
  never persists a `You` allocation row per 11b).
- Web and mobile present the same model and the same badges (`½`, `⅓`, …).
- No regression on multi-unit stepper lines.

---

## Problem 2 — Too many share buttons; one "Share split" like invoice share

### What the user hit
> "We should have only one button to share the split bill result, like we have for sharing the
> invoice."

### Current state
- **Mobile** has three competing affordances: the share-link panel with a "Create share link" /
  re-share "Share" button (`split_bill_screen.dart:791`), **"Share via WhatsApp"**, and **"Copy
  summary"** (`_ActionButtons`, `:852`).
- **Web** shows the `ShareLink` panel (link + Copy + WhatsApp) behind a "Create share link" button
  (`bill-split-dialog.tsx:480`).
- **Invoice share, by contrast, is one button** that mints `/s/<token>` and immediately opens the
  native share sheet (`InvoiceDetailShareRequested` → `_share.share(link.url)`,
  `invoice_detail_bloc.dart:85-91`).

### Goal
Collapse split sharing to a **single primary action that mirrors invoice share**, using the same
`/s/<token>` mechanism and the same `ISharePresenter` / `ShareLink` component already in place.

### Proposed solution
- **Mobile:** one primary **"Share split"** button. On tap: mint the split share link (if not
  already minted) and hand the URL to `ISharePresenter.share(...)` — identical to invoice share.
  The OS share sheet then covers WhatsApp, copy, and everything else, so remove the standalone
  "Share via WhatsApp", "Copy summary", and the separate "Create share link" / re-share panel.
  Delete the now-unused `SplitBillWhatsAppRequested` / `SplitBillCopyRequested` events and their
  handlers; keep `SplitBillShareLinkRequested` as the single mint+share path.
- **Web:** a single **"Share split"** button that reuses the shared `ShareLink` panel (the exact
  component invoice share uses — link + Copy + WhatsApp) so both surfaces have one visual identity.
  No separate "Create share link" step visible before it; mint on click, then reveal the panel.

The share copy/`waText` (`"Here's how we split {merchant}: {url}"`) and the 7-day expiry note are
preserved.

### Acceptance criteria (Problem 2)
- Exactly one share affordance for the split result on each surface, visually consistent with
  invoice share.
- Mobile: tapping it mints (or reuses) `/s/<token>` and opens the native share sheet in one action;
  no WhatsApp/Copy/Create-link buttons remain.
- Web: one button reveals the standard `ShareLink` panel; no orphan "Create share link" +
  re-share duplication.
- Dead split-share events/handlers removed; `test/bloc/split_bill_bloc_test.dart` and the web
  `bill-split-dialog` tests updated; `bill-split.spec.ts` e2e still green.

---

## Files in scope
- `Source/webapp/src/components/workspace/bill-split-dialog.tsx`
  (+ `use-bill-split.ts`, `share-link.tsx` reuse, `workspace.css` for the inline toggle styling)
- `Source/mobile/lib/ui/split_bill/split_bill_screen.dart`
  (+ `core/bloc/split_bill/split_bill_{bloc,event,state}.dart` for the removed share events)
- Tests: `Source/webapp/src/test/e2e/bill-split.spec.ts`,
  `Source/mobile/test/bloc/split_bill_bloc_test.dart`, and the dialog unit tests.

## Out of scope
- Backend 11b contract (`/invoices/{id}/splits*`) — no change.
- The premium hard-gate and upsell card — unchanged.
- Multi-unit stepper mechanics — unchanged except for the shared hint copy.

## DoD
- [ ] Web + mobile present the same single-unit sharer model and the same single share button.
- [ ] Σ shares === line total; no persisted `You` allocation (invariant preserved).
- [ ] Dark-mode parity, tabular-nums on money, usable at 768px (web).
- [ ] `npm run test:unit` (web) + `flutter test` (mobile) green; `bill-split.spec.ts` green.
