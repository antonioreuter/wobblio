# 16h — Merchant Search + Tag Vocabulary (deferred backend + review edits)

**Mobile epic | Parent: [16](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

The slice that closes the two backend gaps the review screen depends on, then wires the mobile
edits that need them: **merchant tap-to-fix** and the **add-tag picker** (deferred from 16e).

## Dependencies
- [16e](./16e-mobile-review.md) (review screen this extends)
- [08](../08-data-intelligence-layer.md) (merchant table, alias model) · §6.10.4 (tag vocabulary)

## Backend (new endpoints)
- **`GET /merchants/search?q=`** — search-as-you-type over the merchant table using **pg_trgm**
  fuzzy match (the extension is already enabled). Tenant-scoped reads. Returns `{ merchants: [{ id,
  name, ... }] }`. Model on the existing `/products/search` handler/service shape.
- **Tag-vocabulary endpoint** (e.g. `GET /reference/tags` or `/tags/vocabulary`) — exposes the
  **fixed** tag vocabulary §6.10.4 so the picker can constrain choices. Static/reference data,
  cacheable. Respect the brand-identity tag guard (memory `brand-identity-tag-guard`) — the
  vocabulary excludes pure merchant-identity tags.

Both follow `code-quality-guard.md` (hexagonal): port + service + adapter, no SDK in core.

## Mobile (review-screen edits, from 16e)
- **Merchant tap-to-fix**: search-as-you-type against `/merchants/search`; selecting a merchant
  writes a `USER_CONFIRMED` alias via the correction/confirm path.
- **Add-tag picker**: pick from the tag-vocabulary endpoint; chips are removable. Constrained to the
  vocabulary (no free-text tags).

## Reuse references
- `Source/backend/.../products/search` (handler/service/adapter shape, pg_trgm usage).
- `Source/webapp/src/components/workspace/invoice-drawer.tsx` (merchant/tag editing reference, if
  present) — otherwise this is net-new UX on top of 16e.
- §6.10.4 tag vocabulary; memory `brand-identity-tag-guard`.

## Out of scope
- Anything already shipped in 16e (date/total/line-item edits, confirm/discard).

## Checklist
- [ ] `GET /merchants/search` (pg_trgm, tenant-scoped) — port + service + adapter
- [ ] Tag-vocabulary endpoint (fixed §6.10.4 vocabulary; brand-identity tags excluded)
- [ ] `skill:hexagonal-architecture-validator` exit 0; `test:unit` for both endpoints
- [ ] Mobile merchant tap-to-fix → search → `USER_CONFIRMED` alias
- [ ] Mobile add-tag picker over the vocabulary; removable chips; no free-text
- [ ] `flutter analyze` clean; review-screen widget/BLoC tests updated

## Verification
- `GET /merchants/search?q=alb` returns ranked fuzzy matches; tenant isolation holds.
- The vocabulary endpoint returns the fixed §6.10.4 set with no merchant-identity tags.
- Selecting a merchant in review writes a `USER_CONFIRMED` alias; adding a tag persists and is
  constrained to the vocabulary.
