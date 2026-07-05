# 18h — Split Bill

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New screen `ui/split_bill/split_bill_screen.dart`. Depends on `18a`, `18b` (reached from Invoice
Detail). Last of the `18d`–`18h` slices — closes the "No Split-bill button" gap `18b` flagged.

> **Re-synced 2026-07-05.** This spec now documents the **units-based, multi-participant** split
> contract + **public share magic-links** the backend moved to (2026-07-03). It supersedes the
> original single-participant `fraction`/`PATCH`/`DELETE` contract (mobile was re-synced to match — see
> the `18-00` handoff). Reference: `Source/webapp/src/components/workspace/{use-bill-split.ts,
> bill-split-dialog.tsx}` + `s/[token]/shared-split-view.tsx`.

## Backend contracts (`Source/backend/src/handlers/api-handler/splitRoutes.ts`)

Split routes Premium-gated (`PREMIUM_ROLES = {PREMIUM, TESTER, ADMIN}` — 403 for everyone else). The
shared-split resolver is **public/unauthenticated** (the token is the only credential).

| Method | Path | Notes |
|---|---|---|
| POST | `/invoices/{id}/splits` | 201 `{ splitId }`. **No idempotency** — mints a new split row on every call. |
| GET | `/invoices/{id}/splits/{splitId}` | 200 `{ id, invoiceId, allocations: SplitAllocation[] }` (several allocations may share a `lineId`). 404 unknown split. |
| PUT | `/invoices/{id}/splits/{splitId}/lines/{lineId}/allocations` | `{ allocations: [{ participantName, units }] }` → 204. **Atomically replaces** the whole allocation set for one line (empty array clears it; remainder → "You"). Rejects `"You"`, non-positive units, and a total exceeding the line quantity with 400. |
| GET | `/invoices/{id}/splits/{splitId}/summary` | 200 `SplitSummary`. |
| GET | `/invoices/{id}/splits/{splitId}/whatsapp` | 200 `{ text }` — pre-formatted export string. |
| POST | `/invoices/{id}/splits/{splitId}/share` | 201 `{ shareUrl, expiresAt }` — a public read-only `/s/{token}` link, 7-day expiry. The split id is never exposed. |
| GET | `/shared-splits/{token}` *(public)* | 200 `{ merchant, date, currency, participants: SplitParticipant[], grandTotal }`. 404 invalid/expired. |

```ts
interface SplitAllocation { lineId: string; participantName: string; units: number }
interface SplitItem { lineId: string; label: string; qty: number; fraction: number; amount: number }
interface SplitParticipant { name: string; subtotal: number; fees: number; total: number; items: SplitItem[] }
interface SplitSummary { participants: SplitParticipant[]; grandTotal: number }
```

The fee-pool-proportional-share math (`computeSplitSummary`) lives only on the backend — every
client mutation replaces a line's allocation set then refetches `allocations` + `summary` rather than
recomputing totals locally.

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
- `split_allocation.dart`: `SplitAllocation { lineId, participantName, units }` (several may share a
  `lineId`) + `LineAllocation { participantName, units }` (the `PUT` input).
- `split_summary.dart`: `SplitItem { lineId, label, qty, fraction, amount }`, `SplitParticipant
  { name, subtotal, fees, total, items }`, `SplitSummary { participants, grandTotal }`.
- `shared_split.dart`: `SharedSplit { merchant?, date?, currency?, participants: SplitParticipant[],
  grandTotal }` (the public `/shared-splits/{token}` projection; reuses `SplitParticipant`/`SplitItem`).

All plain immutable `Equatable` classes, field-for-field mirrors of the backend contract above.

### Ports
- `lib/core/ports/split_id_cache.dart` (`ISplitIdCache`): `read(invoiceId)` / `write(invoiceId,
  splitId)`. Key format `'wobblio:split:$invoiceId'`, mirroring the webapp's `STORAGE_PREFIX`.
- `lib/core/ports/split_repository.dart` (`ISplitRepository`): `createSplit`, `getSplit` (→
  `List<SplitAllocation>`), `setLineAllocations` (whole-line replace), `getSummary`, `getWhatsAppText`,
  `createShareLink` (→ share URL), `getSharedSplit` (public) — a thin 1:1 wire mapping. No split-id
  caching here by design (see resolved conflict above).
- `lib/core/ports/deep_link_source.dart` (`IDeepLinkSource`): `initialLink()` (cold-start) + `links`
  stream (warm) of inbound deep-link `Uri`s.

### Adapters
- `lib/infrastructure/adapters/shared_prefs_split_id_cache.dart` (`SharedPrefsSplitIdCache`) over the
  `shared_preferences` package.
- `lib/infrastructure/adapters/http_split_repository.dart` (`HttpSplitRepository`) over `IApiClient`.
  `getSharedSplit` reuses the same client — its Dio auth interceptor no-ops when no token is present,
  so the public call works signed-out.
- `lib/infrastructure/adapters/app_links_deep_link_source.dart` (`AppLinksDeepLinkSource`) over the
  `app_links` package.

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
  `activeParticipant` back to `"You"` if it was active, then strips them from every line they held by
  re-committing that line's *kept* allocations (`Future.wait` over per-line
  `setLineAllocations(...kept)`, each individually caught), always refreshes afterward, then reverts
  the local participant list + shows a notice only if one or more of the re-commits failed — ports
  `removeParticipant` + `removeParticipantChip`'s combined shape.
- `SplitBillLineTapped(lineId)` *(single-unit lines)*: the `cycleShare`/`resetLine` machine — `"You"`
  active → clear the line's allocations (never allocatable, it's the implicit remainder owner);
  unassigned or owned by someone else → assign `units: 1` (single owner, replaces the set); owned by
  the active participant → cycle `[1, 0.5, 1/3]` with `EPSILON = 1e-3` (ported verbatim, including the
  `NUMERIC(9,4)` rounding-gap reasoning — 1/3 round-trips as `0.3333`, not Dart's
  `0.3333333333333333`, and the epsilon must clear that gap without letting the three cycle values
  collide), past the end → clear.
- `SplitBillLineStepped(lineId, delta)` *(multi-unit lines)*: ports `stepUnits` — nudges the active
  participant's unit count by ±1, capped at `line.quantity − Σ(other owners' units)`, keeping the
  other owners' allocations. `delta` at zero drops the participant off the line.
- `SplitBillLineReset(lineId)` *(multi-unit lines)*: ports `resetLine` — clears every allocation on
  the line (all units fall back to `"You"`).
- `SplitBillShareLinkRequested()`: ports `shareLink` — `createShareLink` mints a public `/s/{token}`
  URL, stored on state (`shareUrl`) and handed to `ISharePresenter.share` (the native share sheet is
  the mobile analog of the webapp's clipboard-copy + inline link).
- Every successful line mutation replaces the line's allocation set then refetches `allocations` +
  `summary` (`_refreshSplitState`) — the client never recomputes fee-pool math.
- `SplitBillWhatsAppRequested` / `SplitBillCopyRequested`: fetch the backend's pre-formatted
  `.../whatsapp` text, hand it to `ISharePresenter.share` / `.copyToClipboard` respectively — the
  widget only dispatches events, it never calls the port directly.
- `notice` is cleared at the start of every retryable action (line tap/step/reset, share link,
  WhatsApp/copy, participant remove), matching the established notice-reset-before-retry idiom.

### `SplitBillScreen`
- Non-premium (`forbidden`): a `GlassContainer` upsell card ("Bill splitting is a Premium feature…"),
  mirroring the webapp's `budget-upsell` copy.
- Header: merchant · total · date (`GlassContainer`).
- People section: fixed `"You"` chip (brand-colored) + participant chips (`Avatar` w/ initials, tap to
  select, small × remove button), "Add a person…" `WobblioInput` (Enter-to-submit — see the small
  additive `WobblioInput.onSubmitted` param added this slice) + Add button.
- Assign items section: hint `to **{activeParticipant}**`. Each non-discount/fee line shows an owner
  avatar stack (every allocation + the unallocated remainder → "You", each with a `×N` unit / `½`/`⅓`
  fraction badge). **Single-unit lines** are a tappable row (`SplitBillLineTapped`) — tap to cycle
  `1 → ½ → ⅓ → clear`. **Multi-unit lines** (`quantity > 1`) are static, with a `+/−` stepper
  (`SplitBillLineStepped`, disabled at bounds) when the active participant ≠ "You", or a "Reset"
  affordance (`SplitBillLineReset`) when "You" is active and the line has allocations.
- Progress line: "{sum of every non-You participant's total} of {grandTotal} assigned · use +/− for
  quantities, tap a single item for ½ or ⅓".
- Summary section: `GlassContainer` per `summary.participants` entry (avatar/name, itemized lines,
  "Fees & charges" row, per-person total), grand total row.
- Share section: "Create share link" (`SplitBillShareLinkRequested`); once minted, the read-only URL
  is shown with a re-share action + a "expires in 7 days" hint.
- Footer: "Share via WhatsApp" (primary) + "Copy summary" (outline) buttons — both dispatch bloc
  events; the port call happens in the bloc.
- Participant color palette: a local 9-color rotation (`_kSplitPalette`, indigo/teal/amber/rose/
  violet/sky/green/pink/yellow) mirroring the webapp's `SERIES_COLORS`/`seriesColor` — "You" is always
  index 0; named participants rotate through the rest by their index in `state.participants`.
- Wrapped in its own `BlocProvider` pulling `locator<SplitBillBloc>(param1: invoiceId)`, same
  retrieval syntax as `InvoiceDetailScreen`.

### Public shared-split page + deep link
- `SharedSplitBloc` (`lib/core/bloc/shared_split/`, `registerFactoryParam` by token) →
  `getSharedSplit`; `SharedSplitStatus { loading, ready, notFound, failure }` (404 → `notFound`).
- `ui/shared_split/shared_split_screen.dart`: standalone read-only page (no auth chrome, no bottom
  nav) porting `shared-split-view.tsx` — header (merchant · date · people badge · grand total),
  per-participant cards, an invalid-link empty state.
- **Reachable via a full universal/app link.** `WobblioApp` gets a `GlobalKey<NavigatorState>`;
  `ui/deep_link/deep_link_listener.dart` (wrapping `AuthGate`) subscribes to `IDeepLinkSource`
  (initial + stream) and, on a `^/s/([^/]+)$` path (`https://wobblio.app/s/{token}` **or** the
  `wobblio://s/{token}` fallback), pushes `SharedSplitScreen(token)` onto the root navigator — **above
  `AuthGate`, so it renders signed-out** (the page only hits the public endpoint).
- **Native config:** Android App-Links `intent-filter` (`autoVerify`, `https://wobblio.app` /s/) + a
  **host-scoped** `wobblio://s` fallback filter (a *broad* `wobblio` scheme filter must never be added —
  it steals flutter_appauth's `wobblio://auth/callback`); iOS `Runner.entitlements`
  (`applinks:wobblio.app`; the `wobblio` custom scheme is already registered in `Info.plist`).

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
- **Universal-link auto-verification prerequisites (external follow-up):** hosting
  `wobblio.app/.well-known/assetlinks.json` (Android; release-cert SHA-256) +
  `apple-app-site-association` (iOS; Team+bundle ID), and referencing `Runner.entitlements` from the
  Xcode Runner target's `CODE_SIGN_ENTITLEMENTS`. Until done, the `wobblio://s/{token}` custom scheme
  is the working fallback.

## Checklist

- [x] Domain models (`SplitAllocation`/`LineAllocation`, `SplitItem`, `SplitParticipant`,
      `SplitSummary`, `SharedSplit`)
- [x] `ISplitIdCache`/`SharedPrefsSplitIdCache` + `ISplitRepository`/`HttpSplitRepository`
      (units `setLineAllocations`, `createShareLink`, public `getSharedSplit`)
- [x] `SplitBillBloc`: fail-closed premium gate, split-id resolve-with-cache-fallback, single-unit
      tap-cycle + multi-unit `+/−` stepper/reset, share link, optimistic participant remove w/ revert,
      refetch-after-every-mutation
- [x] `SplitBillScreen`: upsell card, people chips + add/remove, single/multi line rows + owner stack,
      per-person summary, share link + WhatsApp share/copy
- [x] Public page: `SharedSplitBloc` + `SharedSplitScreen`; deep link via
      `IDeepLinkSource`/`AppLinksDeepLinkSource` + root-navigator listener + Android/iOS native config
- [x] `InvoiceDetailScreen` Split bill button wired to `SplitBillScreen`
- [x] DI wiring in `main.dart` (18h block: `IDeepLinkSource`, `SharedSplitBloc`)
- [x] `fvm flutter analyze` → 0 issues; `fvm flutter test test/` → green
      (`split_bill_bloc_test.dart` reworked + new `shared_split_bloc_test.dart`)
