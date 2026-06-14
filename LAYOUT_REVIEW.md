# Dashboard Layout Review — `/dashboard`

Reviewed live at `http://localhost:3000/dashboard` via Playwright (desktop 1440 and mobile 390). Screenshots: `dashboard-desktop.png`, `dashboard-mobile.png`. Layout source: `Source/webapp/src/app/(app)/layout.tsx`, `components/ui/left-nav/left-nav.tsx`, `components/ui/top-bar/top-bar.tsx`, `styles/ds/workspace.css`.

The page is functional but drifts from `Source/webapp/CLAUDE.md` (design system + responsive rules) in several places. Issues below are grouped by severity.

---

## P0 — Spec violations

1. **Mobile tables do not collapse to cards.** Recent Invoices forces horizontal scroll at 390px; STATUS pills clip, tags/actions disappear off-screen. Webapp DoD requires "Responsive down to 768px (tables collapse to cards)". Action: add a card layout breakpoint to `app-table` (≤768px) — render each invoice as a stacked card with merchant header, meta row, status pill, total right-aligned.
2. **Left rail consumes mobile viewport with no toggle.** At 390px the rail still sits at 64px and a duplicate brand wordmark lives in the topbar — wastes ~16% of the viewport. Action: hide `.app-rail` below 768px, expose a topbar hamburger that opens it as a slide-over drawer. Topbar wordmark stays as the brand anchor.
3. **Color-only meaning on budget bars.** `Bar & Restaurants 104%` renders red with no icon/label. CLAUDE.md: "Never encode meaning in color alone — always pair with icon or label." Action: add a status icon + text suffix (e.g. `AlertTriangle` + "over") to each `.budget-row` when over budget; same for amber 85% threshold and green safe.
4. **Stat-card row is incomplete.** Spec calls for **4** cards: MTD spend, Δ vs last month, budget health, scans remaining. Today there are 3 and Δ is folded into card #1. Action: split Δ into its own card and add a Budget Health card (count under/at-risk/over from `Category Budgets`).
5. **Global search missing from topbar.** CLAUDE.md: "Top bar: global search (invoices by tag/merchant/product), quota indicator, theme toggle, avatar menu." Today: wordmark + page title only on the left; no search, no theme toggle. Action: add `.search-wrap` (already styled in `workspace.css:118`) and a theme toggle button between usage chip and avatar.

## P1 — Layout / IA bugs

6. **Duplicate brand chrome on desktop.** `WobblioLogo` lives in the rail (`left-nav.tsx:39`) AND a `Wobblio.` wordmark in the topbar (`top-bar.tsx:48`). Pick one — recommend keeping the rail logo and removing the topbar wordmark (the page title alone is the topbar's left anchor).
7. **Upload card placement is wrong.** Today Upload sits in the right column next to the Spending chart, and Category Budgets sits *below* both. Spec dashboard order: stat row → 2/3 spend-over-time + 1/3 category breakdown → recent invoices table. Upload is a workspace action, not a dashboard module. Action: move Upload into the topbar (or a fixed FAB) and replace the right column with Category Budgets sized as the 1/3 breakdown panel.
8. **Spending by Category chart is too sparse and not aligned with spec.** Spec wants a **spend-over-time area chart** in the 2/3 slot — current bar chart is the category breakdown duplicating the right-side budgets panel. Action: swap to a 6-month area chart (MTD highlighted), and reserve the categorical breakdown for the 1/3 panel.
9. **Wasted whitespace below Category Budgets on desktop.** Right column ends mid-page while Recent Invoices stretches full width below. Either extend Category Budgets with a `View all budgets →` footer link, or stack a second 1/3 panel (e.g. "Top movers vs last month") to balance the grid.
10. **Topbar overflows on mobile.** Usage chip + avatar + plan label + sign-out all stay full-size and wrap onto two rows below 480px. Action: at ≤640px, drop the plan label, collapse usage chip to a compact `9/15` pill with the bar only, and move sign-out into an avatar dropdown.

## P2 — Polish / consistency

11. **Floating Next.js dev indicator (`N`)** overlaps the rail at the bottom-left in dev mode — fine in dev, but ensure it is disabled in production build (`devIndicators` in `next.config`).
12. **Recent Invoices "Actions" column** is two bare icons with no tooltip. Add `title=`/`aria-label` and `has-tip` styling matching the rail buttons.
13. **`Refresh` / `View all`** buttons in the Recent Invoices header are visually heavy and unequal. Make `Refresh` an icon-only `ghost` button and reserve the brand-filled style for `View all`.
14. **Tabular-nums check.** Verify every monetary number on the dashboard (€642.30, deltas, budget %s, totals in table) has `font-variant-numeric: tabular-nums` — DoD requirement. Spot check suggests percentages on budget bars may not.
15. **`Premium` plan badge** in the topbar uses a small crown icon but renders below the avatar with low contrast on dark mode; promote to a chip next to the avatar or remove from the topbar entirely (move into the avatar dropdown).
16. **Dark mode parity not verified in this pass.** Capture both themes before closing fixes; current screenshots are light-mode only.

---

## Suggested build order

1. P0 #2 + #1 — unblock mobile usability (rail drawer + table cards). One PR.
2. P0 #5 + P1 #6 — topbar refit (search, theme toggle, kill duplicate wordmark). One PR.
3. P0 #3 — semantic accessibility on budget bars. Trivial, ship standalone.
4. P0 #4 + P1 #7 + #8 + #9 — dashboard module restructure. Larger PR; align with `specs/mvp/00-design-system-wireframes.md` before coding.
5. P2 cleanup batch — tooltips, button hierarchy, tabular-nums audit, dark-mode QA.

## Validation

- `cd Source/webapp && npm run lint && npm run test:unit`
- Re-snapshot at 390 / 768 / 1280 / 1440 widths in both `[data-theme]` modes; attach to the PR.
- Manual keyboard pass on the new mobile drawer and topbar search (WCAG AA + DoD requirement).
