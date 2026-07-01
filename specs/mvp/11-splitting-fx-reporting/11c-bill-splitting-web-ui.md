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

- `src/components/workspace/bill-split-panel.tsx` — entry from the invoice drawer (action button / tab
  "Split bill", visible only on parsed invoices). Participant name chips (add/remove); line list with
  tap-to-assign to a chip + fraction stepper (1, ½, ⅓); live proportional fee breakdown + per-participant
  summary card; **WhatsApp** button = copy-to-clipboard of the `/whatsapp` text (web variant of native share).
- `src/components/workspace/use-bill-split.ts` — create/load split, assign/remove, fetch summary + whatsapp.
- BFF routes under `src/app/api/invoices/[id]/splits/...` forwarding to backend via `proxyToBackend`.
- Premium gate: for STANDARD show lock + upsell (mirror reports). `data-testid`s: `split-open`,
  `split-add-participant`, `split-assign-{lineId}`, `split-summary`, `split-copy-whatsapp`.

## Checklist

- [ ] `bill-split-panel.tsx` + entry point in `invoice-drawer.tsx`
- [ ] `use-bill-split.ts` hook
- [ ] BFF routes `/api/invoices/[id]/splits/*`
- [ ] Premium gate + upsell
- [ ] Copy-to-clipboard WhatsApp export
- [ ] Playwright happy path: create split → add participants → assign lines → summary reconciles → copy export

## Verify

Webapp `npm run build`; Playwright acceptance against the local stack (seed a Premium tenant + one parsed invoice).
