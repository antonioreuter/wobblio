# 06 — Landing Page & Marketing Site

**Epic 5 | Phase 3 | Required for public launch**

## Overview

Single-page Next.js marketing site with a dynamic waitlist-aware CTA, designed to convert visitors to signups. Content and personas are fully specified in Section 13 of the v2.4 spec.

## Dependencies

- [00 — Design System & Wireframes](./00-design-system-wireframes.md)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md) (for dynamic CTA state)
- [05 — Billing & Stripe](./05-billing-stripe.md) (for pricing table and checkout link)

## Page Sections (in order)

### 1. Hero
- Headline: **"Scan your receipts. Outsmart inflation."** (preferred) or "Your receipts already know where your money goes."
- Subline: "Wobblio reads any receipt with AI — automatic expense tracking, real local price comparison, and shopping lists that know the cheapest store. No bank access. Ever."
- Primary CTA: `Start free` / Secondary: `Sign in`
- Visual: phone mockup mid-scan with parsed line items animating out of receipt

**Dynamic waitlist state:** when `max_free_users_cap` is reached:
- Primary CTA → `Join the priority waitlist`
- Add social proof framing: "2,140 people ahead of you — or skip the line with Premium"
- API call to check waitlist state client-side (cached, 5-min TTL)

### 2. Trust Strip
Three claims with icons:
- "No bank connection required"
- "GDPR-compliant, EU-hosted, delete everything anytime"
- "Your data stays yours — only anonymous price points are shared."

### 3. How It Works (3 steps)
1. 📸 *Snap* — photograph any receipt, even crumpled thermal paper
2. ✨ *Done* — AI extracts every item, price, and store in seconds; you just confirm (microcopy: "Spot a mistake? One tap fixes it — and Wobblio learns.")
3. 📊 *Save* — budgets fill themselves, prices get compared, lists get smarter

### 4. Persona Feature Grid (4 cards — subset of 6 personas)
- **Families** — shared household + alerts ("One family, one picture of the money. Alerts before the budget breaks — not a post-mortem after.")
- **Smart shoppers** — price engine + route splitting ("Same basket, two streets apart, 22% cheaper. Your receipts knew — now you do.")
- **Friends** — bill splitting → WhatsApp ("One photo. Tap who had what. Fair split — including the tip — in your group chat in 30 seconds.")
- **Travelers** — multi-currency ("Three countries, one budget. Every receipt converted on the day you paid — not the day your bank felt like it.")

### 5. Price Engine Showcase
Full-width section showing the Anti-Inflation Price Engine differentiator:
- Static 6-month price chart of one relatable product across two named-look stores
- Caption: "Real prices from real receipts in your area — including the in-store promos no website lists."
- Honest badge: "Comparisons unlock as your area's data grows — every scan makes it smarter."

### 6. Pricing Table
Two columns: Free vs Premium:
- Annual (€25/yr) visually pre-selected; "2 months free" badge
- Monthly (€2.50/mo) shown as alternative
- Free column: honest (3 scans/week, 3 lists, basic reports)
- Premium column: households, budgets & alerts, bill splitting, price comparison & route optimizer, multi-currency, weekly AI savings advisor
- Footnote: "Cancel anytime. Subscriptions are handled on the web — no app-store markup baked into your price."

### 7. FAQ (6 questions)
1. Is my financial data safe? (RLS, encryption, EU hosting, no bank link)
2. What happens to my receipts? (images deleted after 18 months, parsed data until account deletion)
3. What's this "community price index"? (anonymous price points only — product, store, region, date; never who, never full basket)
4. Does it work with receipts from any store/country? (yes — AI reading, not store integrations)
5. Can I export or delete everything? (one-tap export, full deletion, GDPR Art. 17/20)
6. Why is there a waitlist? (capacity guardrail — Premium skips the line)

### 8. Final CTA + Footer
- Repeat hero CTA
- Footer: privacy policy, terms, imprint, contact, language switcher (NL/EN at launch)

## Funnel Tracking

The page emits events for KPI conversion funnel:
- Hero CTA click
- Pricing view
- Signup start
- Signup complete
- Waitlist join

Events wire into `kpi_daily` (conversion KPI top-of-funnel denominator, Epic 15).

---

## Checklist

### Page Structure
- [ ] Single-page Next.js marketing site (App Router or Pages — consistent with the web app)
- [ ] Mobile-responsive down to 375px
- [ ] Dark/light mode support per design system
- [ ] Language switcher: NL/EN (i18n setup with `next-intl` or equivalent)
- [ ] `next/head` with proper SEO meta tags (title, description, og:image)

### Hero Section
- [ ] Headline + subline copy
- [ ] Primary and secondary CTA buttons
- [ ] Phone mockup visual (static or CSS animation)
- [ ] Dynamic waitlist CTA: API call to `GET /waitlist/status` (public endpoint, no auth)
- [ ] Cache waitlist state client-side for 5 minutes to avoid per-pageload API calls
- [ ] Smooth transition between normal CTA and waitlist CTA states

### Trust Strip
- [ ] Three claim items with icons
- [ ] Positioned prominently below hero fold

### How It Works
- [ ] 3-step visual layout with icons
- [ ] Microcopy on step 2

### Persona Grid
- [ ] 4-card grid (responsive: 2×2 on desktop, 1-col on mobile)
- [ ] Each card: persona-voice headline, 2-line scenario, one feature screenshot/illustration

### Price Engine Showcase
- [ ] Full-width section with static chart illustration
- [ ] Honest data-freshness badge

### Pricing Table
- [ ] Two-column layout (Free vs Premium)
- [ ] Annual plan visually pre-selected with "2 months free" badge
- [ ] Feature rows with checkmarks
- [ ] CTAs linking to signup or Stripe checkout
- [ ] Footnote about web-only subscription

### FAQ
- [ ] 6 FAQ items with expand/collapse interaction
- [ ] Covers: security, receipt retention, price index privacy, coverage, export/delete, waitlist

### Footer
- [ ] Links: privacy policy, terms of service, imprint, contact
- [ ] Language switcher
- [ ] App store badges (deferred if apps not yet published)

### Performance & SEO
- [ ] Lighthouse score ≥90 on mobile
- [ ] Open Graph image generated (receipt-to-parsed-data visual)
- [ ] Schema.org structured data (SoftwareApplication)
- [ ] Sitemap.xml

### Analytics & Funnel Tracking
- [ ] `GET /waitlist/status` public Lambda endpoint (returns `{ waitlistActive: bool, position: null | number }`)
- [ ] Client-side event emission for: hero_cta_click, pricing_view, signup_start, signup_complete, waitlist_join
- [ ] Events sent to analytics endpoint that writes to `kpi_daily` via async SQS message (not blocking page interaction)
