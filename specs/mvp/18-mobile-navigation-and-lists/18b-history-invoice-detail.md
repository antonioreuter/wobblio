# 18b — History + Invoice Detail

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New screens `ui/history/history_screen.dart` and `ui/invoice_detail/invoice_detail_screen.dart`.
Depends on `18a`.

## Backend contracts

- **`GET /invoices`** — already called by `IInvoiceRepository.list()` for Dashboard. No query
  params exist server-side (hardcoded `limit=100`, `ORDER BY created_at DESC`, excludes
  `DISCARDED`). History reuses this exact call; search and month-grouping are client-side.
- **`GET /invoices/{id}`**, **`DELETE /invoices/{id}`** — already implemented, but on
  `IReviewRepository`/`HttpReviewRepository` (used by the pre-confirm Review screen), returning the
  existing `InvoiceDetail` model (`lib/core/ingestion/invoice_detail.dart`). **Reuse that model.**
- **`POST /invoices/{id}/share`** — exists on the backend, unused by mobile today.

## Resolved conflict: which port owns `getDetail`/`delete` for a read-only screen?

The HTTP endpoints are identical to what `IReviewRepository` already calls, but that port exists for
the pre-confirm correction workflow (`ReviewScreen`/`ReviewBloc`) — a conceptually different
capability from post-confirm history browsing, even though today's backend happens to serve both from
the same URL. Injecting `IReviewRepository` into a new `InvoiceDetailBloc` would read wrong to future
maintainers (why does "review" own history's read?). **Resolution:** extend `IInvoiceRepository`
(the port `list()` already lives on) with its own `getDetail(id)`, `delete(id)`, and `createShare(id)`
methods. The two adapters' JSON-parsing will look similar — acceptable duplication under this
project's own Rule-of-Three/AHA convention; only extract a shared parser if a third caller appears.
**Do not** create a second `InvoiceDetail` domain model — both ports return the same existing one.

## Resolved conflict: no Split bill button

`OPTION 2A`'s Invoice Detail screen shows Split bill + Share side by side. No `hasSplit`/`canSplit`
field exists on the `InvoiceDetail` contract, and `POST /invoices/{id}/splits` mints a new,
non-idempotent split row on every call — the webapp works around this with a `localStorage`-cached
split id per invoice (`Source/webapp/src/components/workspace/use-bill-split.ts`). Replicating that
correctly is Split Bill screen (`18h`) work. **This screen omits the Split bill button entirely**
rather than shipping one with no correct destination or state.

## Scope

### History (`HistoryBloc` + `HistoryScreen`)
- Port: no new port method — reuse `IInvoiceRepository.list()`.
- `HistoryBloc` (`lib/core/bloc/history/`): loads the same invoice list Dashboard uses; derives
  client-side search-filtered (merchant name + tags) and month-grouped view state. All filter/group
  logic lives in the bloc, not the widget.
- `HistoryScreen`: "Receipts" title + "N scanned · €X this month" subheader (compute from the loaded
  list), `WobblioInput`-based search box, month section headers, ledger rows reusing the visual
  pattern 17d established for Dashboard's recent-invoices list (colored status dot via `MerchantIcon`'s
  brand-color map, merchant name, "date · status" muted line, trailing tabular-nums amount). Row tap
  → `Navigator.push` to `InvoiceDetailScreen(invoiceId: ...)`.

### Invoice Detail (`InvoiceDetailBloc` + `InvoiceDetailScreen`)
- Port: extend `IInvoiceRepository` with `Future<InvoiceDetail> getDetail(String id)`,
  `Future<void> delete(String id)`, `Future<ShareLink> createShare(String id)` (new small
  `ShareLink { url, expiresAt }` model).
- Adapter: add the three methods to `HttpInvoiceRepository`, mirroring `HttpReviewRepository`'s
  existing `_toDetail` parsing style for `getDetail`.
- `InvoiceDetailBloc` (`lib/core/bloc/invoice_detail/`): loads detail on start; exposes `delete()`
  (emits a typed "deleted" state the screen awaits to pop and signal History to refresh — mirrors how
  `ReviewScreen` already returns a value to `DashboardScreen`) and `share()` (returns the URL for the
  screen to hand to the platform share sheet).
- `InvoiceDetailScreen`: glass header card (merchant badge via `MerchantIcon`, name, `WobblioBadge`
  status, tabular-nums total), date/country/region info rows, "View original receipt" button
  (opens `imageUrl`), line-items list (name, category, qty, amount), feedback up/down row (reuse the
  existing feedback pattern/endpoint if screen-agnostic), **Share** + **Delete** buttons — no Split
  bill button (see above).

## Out of scope

- Split bill affordance (`18h`).
- Any change to `ReviewBloc`/`IReviewRepository`.
- True server-side pagination for `GET /invoices` (tracked as a backend follow-up in `18-00`).

## Checklist

- [ ] `IInvoiceRepository` extended with `getDetail`/`delete`/`createShare`; `InvoiceDetail` model
      reused, not duplicated
- [ ] `HistoryBloc`/`HistoryScreen`: search + month grouping, ledger rows, row tap → Invoice Detail
- [ ] `InvoiceDetailBloc`/`InvoiceDetailScreen`: header, info rows, line items, feedback, Share,
      Delete — no Split bill button
- [ ] Delete flow pops and refreshes History
- [ ] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green (new `history_bloc_test.dart`,
      `invoice_detail_bloc_test.dart`)
