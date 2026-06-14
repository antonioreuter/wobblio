# Dashboard Responsive Overhaul — Implementation Plan

> **Status:** Approved, not started. Last updated 2026-06-14.
> **Branch:** `feat/new-design` (create `feat/responsive-pr<N>` per PR below).
> **Related:** `LAYOUT_REVIEW.md` (raw findings), `dashboard-desktop.png`, `dashboard-mobile.png` (baseline screenshots at repo root).

## Resume checklist (read this first if returning cold)

1. Check the **Progress log** at the bottom of this file — it lists which PRs are done, in flight, or pending.
2. Re-run the baseline snapshot if more than a few days have passed (the page evolves): `npm run dev` then Playwright MCP at `/dashboard`, viewports 390 and 1440.
3. Compare against the goal for the next pending PR. If the live page now diverges from what this plan assumes, update the Progress log first, then continue.
4. All work is **CSS + React in `Source/webapp/`**. No backend changes. No new dependencies.

---

## Context

The `/dashboard` page (and the broader app shell) has visual drift from `Source/webapp/CLAUDE.md` and breaks down at the viewport extremes:

- **Mobile (≤768px):** the invoice table forces horizontal scroll, the left rail eats ~17% of the viewport with no toggle, the topbar wraps, and the primary upload CTA is buried below everything.
- **Desktop (1280–1920):** layout is functional but spec-incomplete — only 3 stat cards (spec wants 4), no global search or theme toggle in the topbar, duplicate brand chrome (rail logo + topbar wordmark), and color-only meaning on the budget bars.
- **Ultrawide (≥1920px):** the workspace has no `max-width` cap, so cards, tables, and numbers stretch across the entire monitor — visually thin and off-brand for a finance app.

The goal is **a single responsive web app** (no separate mobile site — mobile capture is Flutter's job) that **adapts composition per breakpoint** rather than scaling a single layout. Visual richness is *tiered*, not lost: desktop keeps density and the rail; mobile gets a drawer + card stacks; ultrawide caps the canvas and uses extra room to add columns, not inflate elements.

## Constraints discovered during recon

- **No Tailwind utility classes** — Tailwind 4 is wired via `@tailwindcss/postcss`, but layout is driven by hand-rolled CSS in `Source/webapp/src/styles/ds/workspace.css` (~40 KB) using CSS custom properties from `src/styles/ds/tokens/`. All responsive changes ship as CSS edits in `workspace.css`, not utility classes. **Match the existing idiom.**
- The codebase **already uses `@container` queries** (e.g. `.app-table` column hiding at 720/860px). Extend that pattern for the new card-list collapse.
- Existing primitives we should reuse (don't create new ones):
  - `src/components/ds/MetricCard.tsx` — stat cards
  - `src/components/ds/ProgressBar.tsx` — budget bars (already auto-tones at 75/85)
  - `src/components/ds/Button.tsx`, `Badge.tsx`, `Tag.tsx`, `Avatar.tsx`
  - `src/components/workspace/InvoiceTable.tsx` — invoice table
  - `src/components/ui/site-header/theme-toggle-button.tsx` — theme toggle (currently landing-only; lift into topbar)
- Missing primitives we must add: a **mobile rail drawer wrapper**, a **topbar search input**, and a **card-list variant** for `InvoiceTable`.

---

## Scope (build order — five PRs)

### PR 1 — Mobile usability foundation (P0)

**Goal:** the dashboard is usable and on-brand at 390px.

1. **Rail → drawer below 768px.**
   - Edit `src/components/ui/left-nav/left-nav.tsx`: split into `<LeftNav>` (existing sticky desktop) and `<LeftNavDrawer>` (slide-over, controlled by an `open` prop).
   - Edit `src/app/(app)/layout.tsx`: render both; the drawer is triggered by a new hamburger button in the topbar.
   - Edit `workspace.css`: at `@media (max-width: 768px)` set `.app-shell { grid-template-columns: 1fr }`, hide `.app-rail`, and add `.app-rail-drawer` styles (fixed, `transform: translateX(-100%)`, `.open { transform: none }`, backdrop with `--z-drawer`).
2. **Invoice table → card list below 768px.**
   - Extend `src/components/workspace/InvoiceTable.tsx`: render the same row data as a stacked card when a container query crosses the threshold. Use one component, two CSS expressions.
   - In `workspace.css`, add a new `@container (max-width: 640px)` block on `.app-table` wrapper: hide `<thead>` and `<tr>` table semantics, restyle each row as a card with merchant header, meta row (category · date · status badge), tags wrap, and total right-aligned with tabular-nums.
3. **Topbar compaction at ≤640px.**
   - Edit `src/components/ui/top-bar/top-bar.tsx`: at small widths drop the plan label, collapse usage chip to `9/15` pill (bar only), move SignOut into a new avatar dropdown.
   - Add hamburger button on the left (visible only ≤768px) wired to the new drawer state via React context or a `useState` lifted into `(app)/layout.tsx`.

**Verification:** Playwright at 390 / 640 / 768; confirm no horizontal scroll, drawer open/close keyboard accessible, tap targets ≥44px.

### PR 2 — Topbar refit + remove duplicate chrome (P0/P1)

**Goal:** topbar matches the spec ("global search · quota · theme toggle · avatar menu") on desktop.

1. **Remove the topbar wordmark.** Edit `top-bar.tsx:46-50` — drop `.topbar-brand`. The rail logo is the brand anchor; the topbar's left slot is just the page title (and the new hamburger on mobile).
2. **Add global search.** Add `<SearchInput>` between title and usage chip. Reuse the existing `.search-wrap` styles already in `workspace.css:118`. Wire it as a controlled input that calls `useRouter().push('/invoices?q=…')` on submit — backend filtering is out of scope here, but the UI lands.
3. **Lift theme toggle into the topbar.** Reuse `src/components/ui/site-header/theme-toggle-button.tsx` — extract to `src/components/ds/ThemeToggle.tsx` and import from both site header and app topbar.
4. **Sign-out into avatar dropdown.** Wrap `Avatar` + plan badge in a popover; move `SignOutButton` (`src/components/ui/top-bar/sign-out-button.tsx`) inside.

**Verification:** Playwright snapshots at 1280 / 1440 / 1920 in light + dark; tab order: hamburger → title → search → usage → theme → avatar.

### PR 3 — Semantic accessibility on budget bars (P0)

**Goal:** kill color-only meaning per CLAUDE.md.

1. Edit `src/components/ds/ProgressBar.tsx`: when `value > 100` render an `AlertTriangle` icon + "over" suffix; when `85 ≤ value ≤ 100` render `AlertCircle` + "near limit". Both visible alongside the percentage, not replacing it.
2. Audit every dashboard number for `font-variant-numeric: tabular-nums` (DoD requirement). Budget percentages currently miss it — add to `.budget-percent` in `workspace.css`.

**Verification:** snapshot at light + dark, screen reader pass on the budgets panel.

### PR 4 — Dashboard module restructure (P0/P1)

**Goal:** match the spec dashboard layout — 4 stat cards → 2/3 spend-over-time + 1/3 category breakdown → full-width recent invoices.

1. **Stat row goes from 3 → 4 cards.** Edit `src/app/(app)/dashboard/page.tsx:62-95`:
   - Split delta out of "Spent This Month" into its own `MetricCard` (e.g. "vs last month  −11.8%").
   - Add a "Budget Health" card sourced from the same data feeding `Category Budgets` (count under / at-risk / over).
2. **Swap "Spending by Category" bar chart for a 6-month spend-over-time area chart.** The current bar chart is the breakdown — that role moves to the right column. Inline `SpendChart` (`dashboard/page.tsx:14-40`) becomes `<SpendOverTimeChart>` (new file under `src/components/workspace/`). Mark this as the only genuinely new component; everything else reuses existing primitives.
3. **Right column: Category Budgets becomes the 1/3 panel.** Remove the standalone "Category Budgets" block at the bottom; promote it into the 1/3 slot beside the spend-over-time chart. Adds a `View all budgets →` footer link.
4. **Upload card out of the dashboard grid.** Move the dropzone into a fixed `Upload` action in the topbar (icon button that opens a modal) — it's a workspace action, not a dashboard module. Update `dashboard/page.tsx` to remove the inline upload block.
5. **Recent Invoices polish.** In `InvoiceTable`, make `Refresh` a ghost icon-only button, keep `View all` brand-filled. Add `title=` / `aria-label` to the share/delete icons in the Actions column.

**Verification:** snapshot at 1280 / 1440; verify the spec order is restored; run `cd Source/webapp && npm run lint && npm run test:unit`.

### PR 5 — Ultrawide containment + density tiers (new)

**Goal:** stop the layout from stretching past 1440px; use extra real estate to add information, not inflate it.

1. **Cap the workspace canvas.** Edit `workspace.css`: introduce a `.app-canvas` wrapper inside `.app-body` (after `.app-topbar`) with `max-width: 1440px; margin-inline: auto;`. Update `(app)/layout.tsx` to wrap `{children}` in `.app-canvas`.
2. **Ultrawide breakpoint at 1920px.** Add `@media (min-width: 1920px)` block:
   - Raise canvas cap to `1600px`.
   - Stat row: 4 → 5 cards (add "Top merchant this month").
   - Recent Invoices: reveal the previously-hidden `confidence` dot column (already hidden at ≤860px container).
3. **Persistent inspection drawer at ≥1600px.** Edit `src/components/workspace/invoice-drawer.tsx` (currently overlay): add a `persistent` variant that docks as a 360px right column rather than overlaying. Dashboard remains overlay; `/invoices` route uses persistent. Toggle is purely CSS-driven via a media query — no extra state.
4. **Cap individual modules.** In `workspace.css`, add `max-width` to `.metric-card` (~480px), chart wrapper (~960px), and `.app-table` (~1280px) so even at 1920px nothing single element grows unbounded.

**Verification:** Playwright at 1280 / 1440 / 1920 / 2560; confirm canvas centers and modules cap. Visual diff dashboard between 1440 and 2560 — only the surrounding background should change.

---

## Files modified (representative)

```
Source/webapp/src/app/(app)/layout.tsx                        — drawer state, .app-canvas wrapper
Source/webapp/src/app/(app)/dashboard/page.tsx                — stat row, module reshuffle, drop inline upload
Source/webapp/src/components/ui/left-nav/left-nav.tsx         — split into LeftNav + LeftNavDrawer
Source/webapp/src/components/ui/top-bar/top-bar.tsx           — hamburger, search, theme toggle, avatar menu
Source/webapp/src/components/ui/top-bar/sign-out-button.tsx   — moved inside avatar dropdown
Source/webapp/src/components/ds/ThemeToggle.tsx               — NEW (extracted from site-header)
Source/webapp/src/components/ds/ProgressBar.tsx               — icon + label suffix for >85% and >100%
Source/webapp/src/components/workspace/InvoiceTable.tsx       — card-list variant under container query
Source/webapp/src/components/workspace/invoice-drawer.tsx     — persistent variant at ≥1600px
Source/webapp/src/components/workspace/SpendOverTimeChart.tsx — NEW (replaces inline SpendChart)
Source/webapp/src/styles/ds/workspace.css                     — drawer styles, ≤768px rail hide, table card-list, tabular-nums fix, ultrawide @media at 1920px, .app-canvas max-width
```

## Verification (end-to-end)

1. `cd Source/webapp && npm run lint && npm run test:unit`
2. `npm run dev`, open `/dashboard` with Playwright MCP and snapshot at **390 / 640 / 768 / 1280 / 1440 / 1920 / 2560** in both `[data-theme="light"]` and `[data-theme="dark"]`. Attach to PR.
3. Keyboard pass: tab through topbar (hamburger → title → search → usage → theme → avatar → drawer items); confirm Esc closes drawer and avatar menu.
4. Screen-reader smoke: budget bars announce "104%, over" and "88%, near limit" — not just the percentage.
5. Confirm no horizontal scroll at 390px; confirm canvas is bounded at 2560px (Spending chart should not exceed 960px).
6. Re-run `npm run skill:hexagonal-architecture-validator` from `Source/backend` — N/A here (frontend-only) but the project convention is to mention it; this change is purely client-side.

## Out of scope (deferred)

- Backend wiring for global search (UI lands; server filter follows separately).
- Theme runtime preferences persistence beyond what `theme-toggle-button` already does.
- PWA install prompt (consider after PR 5 if mobile-web usage warrants it).
- Tailwind utility-class migration (the project deliberately uses hand-rolled CSS; that's a separate decision).

---

## Progress log

Update this section as each PR lands. Format: status · branch · merge commit/PR · notes.

| PR | Status | Branch | Commit/PR | Notes |
|----|--------|--------|-----------|-------|
| 1 — Mobile foundation     | 🟡 In progress | `feat/responsive-pr1` | — | Rail→drawer, table→cards, topbar compaction + avatar menu done. Verified at 390/640/768; lint + 12 unit tests green. Avatar dropdown built here (PR2 item 4 already satisfied). |
| 2 — Topbar refit          | ⬜ Pending | — | — | Wordmark still present (kept for PR2 removal); search + theme toggle still to add |
| 3 — Budget bar a11y       | ⬜ Pending | — | — | Can ship anytime; no dependency |
| 4 — Dashboard restructure | ⬜ Pending | — | — | Depends on PR 1 (table cards reused) |
| 5 — Ultrawide + density   | ⬜ Pending | — | — | Depends on PR 4 (stat row, drawer) |

**Legend:** ⬜ pending · 🟡 in progress · ✅ merged · ❌ blocked (note reason)
