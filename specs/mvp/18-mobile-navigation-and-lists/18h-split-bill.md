# 18h — Split Bill

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New screen `ui/split_bill/split_bill_screen.dart`. Depends on `18a`, `18b` (reached from Invoice
Detail). Last of the `18d`–`18h` slices — closes the "No Split-bill button" gap `18b` flagged.

## Backend contracts (`Source/backend/src/handlers/api-handler/splitRoutes.ts`)

Premium-gated on every route (`PREMIUM_ROLES = {PREMIUM, TESTER, ADMIN}` — 403 for everyone else).

| Method | Path | Notes |
|---|---|---|
| POST | `/invoices/{id}/splits` | 201 `{ splitId }`. **No idempotency** — mints a new split row on every call. |
| GET | `/invoices/{id}/splits/{splitId}` | 200 `{ id, invoiceId, assignments: SplitAssignment[] }`. 404 unknown split. |
| PATCH | `/invoices/{id}/splits/{splitId}/lines/{lineId}` | `{ participantName, fraction? }` → 204. `fraction` defaults to 1, must be in `(0,1]`. `participantName: "You"` → 400 (`InvalidSplitError`) — it's the implicit remainder owner, never assignable. |
| DELETE | `/invoices/{id}/splits/{splitId}/lines/{lineId}/assignment` | 204. |
| GET | `/invoices/{id}/splits/{splitId}/summary` | 200 `SplitSummary`. |
| GET | `/invoices/{id}/splits/{splitId}/whatsapp` | 200 `{ text }` — pre-formatted export string. |

```ts
interface SplitAssignment { lineId: string; participantName: string; fraction: number }
interface SplitItem { lineId: string; label: string; qty: number; fraction: number; amount: number }
interface SplitParticipant { name: string; subtotal: number; fees: number; total: number; items: SplitItem[] }
interface SplitSummary { participants: SplitParticipant[]; grandTotal: number }
```

The fee-pool-proportional-share math (`computeSplitSummary`) lives only on the backend — every
client mutation refetches `assignments` + `summary` rather than recomputing totals locally.

## Resolved conflict: `POST` has no idempotency — the split id must be cached client-side

There is no "list splits for this invoice" endpoint. Reopening the screen and calling `POST` again
would mint an orphaned second split row every time. The webapp already solved this
(`Source/webapp/src/components/workspace/use-bill-split.ts`'s `resolveSplitId`, backed by
`localStorage`) — this slice ports that exact resolve-with-cache-fallback algorithm to mobile via a
new `ISplitIdCache` port (`shared_preferences`-backed), owned by `SplitBillBloc`, not the repository
port (`ISplitRepository` stays a thin 1:1 wire mapping with no caching logic of its own).

## Resolved conflict: the non-premium state is an in-place upsell, not a hidden entry point

`InvoiceDetailScreen`'s Split bill button is always visible to every account, mirroring the webapp's
`bill-split-dialog.tsx` (which opens for anyone and shows an upsell card inside the dialog rather than
disabling the launcher). `SplitBillScreen` itself decides forbidden-vs-ready from
`IProfileRepository.fetchProfile().role`, fail-closed like `BudgetBloc`/`ShoppingListBloc` — no split
API calls are attempted for a non-premium account.

## Scope

### Domain models (`lib/core/splitting/`)
- `split_assignment.dart`: `SplitAssignment { lineId, participantName, fraction }`.
- `split_summary.dart`: `SplitItem { lineId, label, qty, fraction, amount }`, `SplitParticipant
  { name, subtotal, fees, total, items }`, `SplitSummary { participants, grandTotal }`.

All plain immutable `Equatable` classes, field-for-field mirrors of the backend contract above.

### Ports
- `lib/core/ports/split_id_cache.dart` (`ISplitIdCache`): `read(invoiceId)` / `write(invoiceId,
  splitId)`. Key format `'wobblio:split:$invoiceId'`, mirroring the webapp's `STORAGE_PREFIX`.
- `lib/core/ports/split_repository.dart` (`ISplitRepository`): `createSplit`, `getSplit`,
  `assignLine`, `unassignLine`, `getSummary`, `getWhatsAppText` — a thin 1:1 wire mapping over the six
  routes above. No split-id caching here by design (see resolved conflict above).

### Adapters
- `lib/infrastructure/adapters/shared_prefs_split_id_cache.dart` (`SharedPrefsSplitIdCache`) over the
  `shared_preferences` package (already added to `pubspec.yaml` in prior groundwork).
- `lib/infrastructure/adapters/http_split_repository.dart` (`HttpSplitRepository`) over `IApiClient`.

### `SplitBillBloc` (`lib/core/bloc/split_bill/`), `registerFactoryParam`-shaped (constructed with an
`invoiceId`, mirrors `InvoiceDetailBloc`)

- `SplitBillStatus { loading, ready, forbidden, failure }`.
- `SplitBillStarted`: resolve premium (fail-closed) → `forbidden` immediately if not, no split calls
  attempted at all. Otherwise: resolve the split id (`_resolveSplitId`, ports `resolveSplitId`'s exact
  cached-and-valid / cached-but-404-falls-back-to-create / no-cache-creates logic — a cache hit is
  validated with a `GET`, and *any* failure of that validation call, not just a 404, falls back to
  minting + caching a fresh split), then load the invoice detail (lines filtered to
  `!isDiscount && !isDepositOrFee`) and the split's assignments + summary via `Future.wait` (true
  concurrency — building three not-yet-awaited local `Future` variables and awaiting them out of
  order was tried first and is a Dart footgun: a rejected Future sitting in a local variable between
  its creation and a later, out-of-order `await` gets flagged as an unhandled zone error before the
  `await` ever reaches it; `Future.wait` subscribes to all three immediately and sidesteps this).
- State: `invoiceId` (constructor field, not in `SplitBillState`), `splitId`, `merchant`, `total`,
  `currency`, `transactionDate`, `lines: List<InvoiceLineDetail>`, `participants: List<String>`
  (local-only growing set seeded from assignments' distinct names, grown after every refresh via
  `_growParticipants`, never shrunk except an explicit remove), `activeParticipant` (default
  `SplitBillBloc.you = 'You'`), `assignments: List<SplitAssignment>`, `summary: SplitSummary?`,
  `notice`.
- `SplitBillParticipantAdded(name)`: trim, cap at 40 chars, reject empty or case-insensitive `"you"`,
  dedupe case-insensitively (but still sets the newly-typed casing as active even on a dedupe hit —
  ported verbatim from `addParticipant`'s exact behavior, including that quirk).
- `SplitBillParticipantSelected(name)`: sets `activeParticipant`.
- `SplitBillParticipantRemoved(name)`: optimistically drops the chip and reassigns
  `activeParticipant` back to `"You"` if it was active, unassigns every line they held (`Future.wait`
  over per-line `DELETE`s, each individually caught), always refreshes afterward, then reverts the
  local participant list + shows a notice only if one or more of the unassigns actually failed — ports
  `removeParticipant` + `removeParticipantChip`'s combined shape.
- `SplitBillLineTapped(lineId)`: the exact `handleLineTap` state machine — `"You"` active → unassign
  only if a line is assigned (never PATCH-able, it's the implicit remainder owner); unassigned or
  owned by someone else → assign at fraction 1; owned by the active participant → cycle
  `[1, 0.5, 1/3]` with `FRACTION_EPSILON = 1e-3` (ported verbatim, including the `NUMERIC(5,4)`
  rounding-gap reasoning from the webapp's comment — 1/3 round-trips through the backend as `0.3333`,
  not Dart's `0.3333333333333333`, and the epsilon must clear that gap without letting the three cycle
  values collide), past the end → unassign. Every successful mutation refetches `assignments` +
  `summary` (`_refreshSplitState`) — the client never recomputes fee-pool math.
- `SplitBillWhatsAppRequested` / `SplitBillCopyRequested`: fetch the backend's pre-formatted
  `.../whatsapp` text, hand it to `ISharePresenter.share` / `.copyToClipboard` respectively — the
  widget only dispatches events, it never calls the port directly.
- `notice` is cleared at the start of every retryable action (line tap, WhatsApp/copy, participant
  remove), matching the established notice-reset-before-retry idiom.

### `SplitBillScreen`
- Non-premium (`forbidden`): a `GlassContainer` upsell card ("Bill splitting is a Premium feature…"),
  mirroring the webapp's `budget-upsell` copy.
- Header: merchant · total · date (`GlassContainer`).
- People section: fixed `"You"` chip (brand-colored) + participant chips (`Avatar` w/ initials, tap to
  select, small × remove button), "Add a person…" `WobblioInput` (Enter-to-submit — see the small
  additive `WobblioInput.onSubmitted` param added this slice) + Add button.
- Assign items section: hint `tap → **{activeParticipant}**`; each non-discount/fee line is a tappable
  row (name, amount, an `Avatar` showing the current owner — defaults to "You" when unassigned — with
  a small ½/⅓ fraction badge overlay when `fraction != 1`).
- Progress line: "{sum of every non-You participant's total} of {grandTotal} assigned · tap a line
  again for ½ or ⅓".
- Summary section: `GlassContainer` per `summary.participants` entry (avatar/name, itemized lines,
  "Fees & charges" row, per-person total), grand total row.
- Footer: "Share via WhatsApp" (primary) + "Copy summary" (outline) buttons — both dispatch bloc
  events; the port call happens in the bloc.
- Participant color palette: a local 9-color rotation (`_kSplitPalette`, indigo/teal/amber/rose/
  violet/sky/green/pink/yellow) mirroring the webapp's `SERIES_COLORS`/`seriesColor` — "You" is always
  index 0; named participants rotate through the rest by their index in `state.participants`.
- Wrapped in its own `BlocProvider` pulling `locator<SplitBillBloc>(param1: invoiceId)`, same
  retrieval syntax as `InvoiceDetailScreen`.

### Nav
`InvoiceDetailScreen`'s action row gains a "Split bill" outline button (`Icons.groups_outlined`,
`key: invoice-detail-split-bill`) next to Share, always enabled, pushing
`SplitBillScreen(invoiceId: detail.id)`. This resolves the doc comment `18b` left in place ("No
Split-bill button — see 18b-history-invoice-detail.md").

## Out of scope

- A "list splits for invoice" backend endpoint (the client-side cache is the accepted workaround, per
  the resolved conflict above).
- Household-aware participant suggestions (household roster port doesn't exist on mobile yet, same gap
  `18d`/`18f` already flagged).

## Checklist

- [x] Domain models (`SplitAssignment`, `SplitItem`, `SplitParticipant`, `SplitSummary`)
- [x] `ISplitIdCache`/`SharedPrefsSplitIdCache` + `ISplitRepository`/`HttpSplitRepository`
- [x] `SplitBillBloc`: fail-closed premium gate, split-id resolve-with-cache-fallback, fraction-cycle
      tap state machine, optimistic participant remove w/ revert, refetch-after-every-mutation
- [x] `SplitBillScreen`: upsell card, people chips + add/remove, assignable line rows, per-person
      summary, WhatsApp share/copy
- [x] `InvoiceDetailScreen` Split bill button wired to `SplitBillScreen`
- [x] DI wiring in `main.dart` (18h block)
- [x] `fvm flutter analyze` → 0 issues; `fvm flutter test test/` → green (new
      `split_bill_bloc_test.dart`)
