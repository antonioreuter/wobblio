# 11b — Bill Splitting Backend (Premium)

Parent: [11](../11-bill-splitting-fx-reporting.md) · Handoff: [11-00](./11-00-handoff.md) · Depends: —

## Goal

Proportional bill splitting on any parsed invoice: assign whole/fractional line items to named
participants, allocate taxes/tips/service fees proportionally to subtotal shares, and export a
WhatsApp-ready summary. Premium-only.

## What already exists

- `bill_split(id, invoice_id, created_at)` + `bill_split_line(split_id, line_id, participant_name_enc, fraction)` **with RLS** (`20260611152000_initial_schema.ts`).
- `IKmsEncryption` (`encrypt`/`decrypt`) + `encryptionFactory` for `participant_name_enc` (invariant #9). Pattern: `ShareInvoiceService`.
- `IInvoiceRepository.getDetail` returns invoice head (total, currency, merchant, date) + lines (`id`, `lineTotal`, `quantity`, `rawText`). NOTE: `InvoiceDetailLine` lacks `is_discount`/`is_deposit_or_fee` — extend it (adapter already reads `invoice_line`).

## Design

New family `splitting/`. **Premium-gated** (`PREMIUM_ROLES` set in the route, per `priceTrendRoutes.ts`).

**Fee derivation** (locked decision): `assignableSubtotal = Σ line_total where NOT is_discount AND NOT is_deposit_or_fee`; `feePool = invoice.total − assignableSubtotal`.

**Domain** `src/core/domain/billSplit.ts` — pure:
```
computeSplitSummary(lines, assignments, invoiceTotal) → {
  participants: { name, subtotal, fees, total, items: {lineId, label, qty, fraction, amount}[] }[],
  grandTotal
}
```
- per participant P: `P_subtotal = Σ(line_total × fraction)`; `P_share = P_subtotal / assignableSubtotal`;
  `P_fees = feePool × P_share`; `P_total = P_subtotal + P_fees`. Guard `assignableSubtotal === 0` (no fee spread; return zeros). Round money to 2dp; reconcile rounding residual onto the largest share so Σ participant totals === grandTotal.

**Port** `src/core/ports/splitting/IBillSplitRepository.ts`:
- `create(invoiceId): Promise<string>`
- `getMeta(splitId): Promise<{ id, invoiceId } | null>`
- `listAssignments(splitId): Promise<{ lineId, participantNameEnc, fraction }[]>`
- `upsertAssignment(splitId, lineId, participantNameEnc, fraction): Promise<void>` (PK `(split_id,line_id)` → one participant per line; fractional split of a single line across people is a future extension, out of MVP scope — see note)
- `removeAssignment(splitId, lineId): Promise<void>`

> Note: `bill_split_line` PK is `(split_id, line_id)`, so a line maps to exactly one participant per split (with a fraction ≤ 1 for "I only had half of this shared line"). Sharing one line across multiple named people would need a PK change — deferred; the spec's "starter shared by 3" is modeled as three separate lines or fraction on distinct lines in MVP.

**Service** `src/core/services/splitting/BillSplitService.ts`:
- `createSplit(invoiceId)`, `getSplit(splitId)` (decrypts names), `assignLine(splitId, lineId, participantName, fraction)` (validates `0 < fraction ≤ 1`, encrypts name), `removeAssignment`, `summary(splitId)` (loads invoice detail, runs domain formula), `whatsAppExport(splitId)` (formats spec emoji template). Throws `InvoiceNotFoundError`, `BillSplitNotFoundError`, `InvalidSplitError`.

**Adapter** `src/infrastructure/adapters/splitting/BillSplitRepositoryAdapter.ts` — pg; existing RLS covers both tables.

**Routes** `src/handlers/api-handler/splitRoutes.ts`; delegate from `handleInvoicesRoute` on `/invoices/{id}/splits...`. Gate to `PREMIUM_ROLES`.
- `POST   /invoices/{id}/splits`
- `GET    /invoices/{id}/splits/{sid}`
- `PATCH  /invoices/{id}/splits/{sid}/lines/{lid}`  body `{ participantName, fraction }`
- `DELETE /invoices/{id}/splits/{sid}/lines/{lid}/assignment`
- `GET    /invoices/{id}/splits/{sid}/summary`
- `GET    /invoices/{id}/splits/{sid}/whatsapp`  → `{ text }`

## Checklist

- [ ] Domain formula + rounding reconciliation
- [ ] Port + adapter (RLS round-trip)
- [ ] Extend `InvoiceDetailLine` with `isDiscount`/`isDepositOrFee`
- [ ] Service with KMS encrypt/decrypt of participant names
- [ ] 6 endpoints wired + Premium gate
- [ ] WhatsApp formatter matches spec template
- [ ] Unit: formula (fraction 1.0, fraction 0.5, 3-way, mixed BTW lines, feePool=0, zero-subtotal guard) + service (mocked ports); integration: adapter + encryption round-trip
- [ ] `npm run validate:security` (RLS-table adapter)

## Verify

Hexagonal validator, unit, integration, validate:security all green.
