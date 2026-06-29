# 08 — Debug-Sample Endpoint (GDPR-gated)

**Non-Functional 02 · carved out of [03](./03-system-fault-quarantine.md) §8–§9 · deferred from the 2026-06-28 core pass**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) §3 · Index: [README](./README.md)

## ⚠️ SHIP BLOCKER

This endpoint exposes **pseudonymised personal data** (a quarantined receipt image whose S3 key encodes
the tenant). It **must not ship** until:
- **DPO / counsel sign-off**, and
- a **`gdpr-privacy-officer` rule review**, and
- a **signup-ToS debugging-use clause** exists (legitimate-interest lawful basis).

Carved out of 03 so the rest of 03 (core + 06 + 07) can ship without waiting on legal. Build only after
sign-off.

## Design

### Endpoint
`GET /admin/faults/sample.zip?reason=<root-cause>` (admin-route gated, audited):
- Returns **≤ 2 quarantined images per distinct root cause** — minimisation.
- Images delivered as **opaque bytes only** inside the zip — **never** the tenant-revealing S3 key/path,
  filename, or any metadata. Generate via **≤ 300s presigned GETs** (invariant #10) fetched server-side
  and streamed into the zip under opaque names (e.g. `sample-1.jpg`).
- Audited like every admin mutation (`AdminAuditLogAdapter`, e.g. action `fault.debug_sample`), capturing
  actor + reason + count (never the tenant).

### GDPR controls (§03.9)
- **Lawful basis:** legitimate interest + the new ToS debugging clause.
- **Minimise:** ≤ 2 per root cause; only quarantined (system-fault) invoices; no content beyond the image
  bytes needed to reproduce the parse failure.
- **Purge:** delete pulled samples after debugging, and on account deletion (Epic 13 cascade must reach
  any retained debug copies).
- **No tenant linkage leaves the server:** the invoice→owner link and the tenant-encoding S3 key stay
  server-side; the operator receives only opaque image bytes.

## Checklist
- [ ] **DPO/counsel sign-off + `gdpr-privacy-officer` review + ToS clause — all present before ship**
- [ ] `sample.zip` route: ≤2/root-cause, opaque bytes only (no key/path/filename leak), ≤300s presigned GETs
- [ ] Audited (actor + reason + count, never tenant)
- [ ] Purge after debug + on account deletion (Epic 13)
- [ ] `validate:security` green
