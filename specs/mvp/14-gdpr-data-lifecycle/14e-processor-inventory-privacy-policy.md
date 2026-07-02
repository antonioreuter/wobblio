# 14e — Processor Inventory & Privacy Policy Page

**Epic 14 | Parent: [14](../14-gdpr-data-lifecycle.md) · Tracker: [00-handoff](./00-handoff.md)**

Status: ⬜ not started · content-complete only once 14a–14d ship (the copy must describe real behavior)

## Scope

Almost entirely webapp/docs content — no new backend capability once the other slices land.

- `/privacy` page (Next.js webapp): data categories, retention schedule table (receipt images 18mo,
  parsed data until deletion, export ZIPs 7 days, payment transactions 7 years, price observations
  indefinite/never deleted), de-identification explanation for the price index, price-contribution
  opt-out explanation (linking to the settings toggle from 14a).
- Processor inventory disclosure: AWS (Lambda compute, S3/RDS storage, SES email, SNS push, Bedrock
  AI inference), Stripe (payments), Bedrock model providers (AI inference, opaque model IDs "subject
  to change via admin").
- Signup flow: mandatory checkbox linking to `/privacy` + terms of service (checkbox itself likely
  already exists per onboarding's `consent` requirement — verify and only add the link/copy if
  missing).

## Checklist

- [ ] `/privacy` page: all data categories, retention schedule, de-identification explanation,
      opt-out explanation
- [ ] Processor inventory section (AWS breakdown, Stripe, Bedrock model providers)
- [ ] Signup checkbox links to `/privacy` + ToS (verify existing checkbox, add link if missing)

## Verification

- `/privacy` renders and every retention-schedule row matches the actual shipped behavior (not
  aspirational text) — cross-check against 14a/14b/14c/14d's actual implementation before publishing.
