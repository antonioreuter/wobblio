# Fix 05 — Mobile/Web/Backend Parity Roadmap

**Priority: P2 first item (a shipped backend feature currently delivers to zero users), P3 rest.**
**Tag:** [GAP] (surface parity) · **DB migration:** none here (each item's own spec decides).

Cross-surface gaps found in Phase 1. Each item names the owning epic; this file exists so the
parity picture is visible in one place — implementation detail belongs in the owning specs.

## 1. Push pipeline has a head and no tail — P2

Backend 16f is ✅ (device_token table, `POST /me/device-token`, SNS adapter, worker pushes on
PARSED/NEEDS_REVIEW + system-fault/reprocess). But **16g (push client) is ⬜ and
`Source/mobile/lib` contains zero references to `device-token`** — no device ever registers, so
every push is built, best-effort-attempted, and delivered to nobody. Ship 16g
(`specs/mvp/16-mobile/16g-push-client.md`, already written) next mobile slice; until then the SNS
platform-app runbook cost is pure overhead. Also open (recorded in 16-00): user-fault FAILED has
no push; budget-alert pushes still `MockPushAdapter`.

## 2. Web cannot correct invoices; mobile can — P3

Owned by `specs/mvp/07-core-ingestion-pipeline/07c-web-correction-parity.md` (written this audit).

## 3. Bill splitting: backend + web only — P3

11b/11c shipped; mobile entry (18h, reached from Invoice Detail) is "not started, not spec'd" in
`18-00-handoff.md`. A `sample-mobile-split-bill.png` mock already sits in the 11 spec dir — the
product intent exists. Write 18h against 11b's contract (note 11c's locked localStorage split-id
workaround; decide whether mobile persists split-id the same way or 11b grows
`GET /invoices/{id}/splits`, which would let web drop the workaround too — prefer the endpoint).

## 4. Reports/price-trends: web only — P3

The comparison chart + own-price history are web; mobile 18e is unspec'd. Also backend 11d
(`/reports/*` drill-down endpoints) is the only unshipped slice of epic 11 — spec 18e and 11d
together so mobile doesn't bind to view-model-shaped web BFF responses.

## 5. Shopping-list offline sync: spec'd, never built — P3

10b promises "locally encrypted cache, check-off offline, sync on reconnect, last-write-wins",
deferred to the Flutter build. 18c shipped the mobile list screen **online-only**
(`HttpShoppingListRepository`, no local store). The 10b note still says mobile doesn't exist.
Either build the offline layer (port + local adapter per flutter-architecture-guard) or amend 10b
to drop the promise; don't leave it dangling.

## 6. NF-03 local image validation: spec'd, no code — P3

`specs/non-functional/03-mobile-local-image-validation.md` (370 lines) has no corresponding
Flutter code (no blur/glare/quality gate before upload). Each rejected-at-capture photo saves a
full vision-parse credit + a user-fault round-trip — it's also the cheapest credit-model
protection. Schedule after 16g.
