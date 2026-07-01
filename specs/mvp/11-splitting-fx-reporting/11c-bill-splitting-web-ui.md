# 11c — Bill Splitting Web UI

Parent: [11](../11-bill-splitting-fx-reporting.md) · Handoff: [11-00](./11-00-handoff.md) · Depends: 11b

## Goal

Web bill-split UX inside the invoice drawer: participant chips, per-line assignment, proportional
fee breakdown, per-participant totals, and a WhatsApp copy-to-clipboard export.

## What already exists

- `invoice-drawer.tsx` (right-slide panel, photo + line items + location gate + share/delete).
- BFF proxy `src/lib/server/api-proxy.ts` (`proxyToBackend`) + client hooks `use-*.ts`.
- DS components: `Button`, `Card/panel`, `Tag`, `Badge`, `Money`, Lucide icons; `data-testid` convention.
- Premium gating pattern (reports page upsell + lock icon).

## Design

- `src/components/workspace/bill-split-dialog.tsx` — entry from the invoice drawer (footer button
  "Split bill", visible only when `invoice.status[1] === 'Ready'`, i.e. PARSED/NEEDS_REVIEW). Built as
  a modal (mirrors `ShareDialog`), not an inline drawer panel — the drawer already scrolls a lot
  (details, location gate, receipt toggle, line items, feedback) and the split UI needs its own room.
  Participant name chips (add/remove); line list with tap-to-assign to a chip + fraction stepper
  (1, ½, ⅓); live proportional fee breakdown + per-participant summary card; **WhatsApp** button =
  copy-to-clipboard of the `/whatsapp` text (web variant of native share). No `GET /invoices/{id}/splits`
  list endpoint exists (11b), so the split id is cached in `localStorage` per invoice to avoid minting a
  fresh orphan split on every drawer reopen.
- `src/components/workspace/use-bill-split.ts` — create/load split, assign/remove, fetch summary + whatsapp.
- BFF routes under `src/app/api/invoices/[id]/splits/...` forwarding to backend via `proxyToBackend`.
- Premium gate: for STANDARD show lock + upsell (mirror reports). `data-testid`s: `split-open`,
  `split-add-participant`, `split-assign-{lineId}`, `split-summary`, `split-copy-whatsapp`.

## Checklist

- [x] `bill-split-dialog.tsx` (modal, not inline panel — see handoff) + entry point in `invoice-drawer.tsx`
- [x] `use-bill-split.ts` hook
- [x] BFF routes `/api/invoices/[id]/splits/*`
- [x] Premium gate + upsell
- [x] Copy-to-clipboard WhatsApp export
- [x] Playwright happy path: create split → add participants → assign lines → summary reconciles → copy export

## Verify

Webapp `npm run build`; Playwright acceptance against the local stack (seed a Premium tenant + one parsed invoice).
