# 12d — DLQ Inspection & Replay

**Epic 10 | Phase 5 | Parent: [12 — Admin Console](./12-admin-console.md)**

Inspect, replay, and discard messages in the ingestion DLQ. **Gap:** the codebase has no SQS
*read* path today — only `SqsIngestionQueueAdapter` (write). This sub-spec adds the reader.

## Dependencies

- [12a — Admin Foundation](./12a-admin-foundation.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (DLQ, `maxReceiveCount=3`)

## Backend

Endpoints (ADMIN-gated; replay/delete audit-logged):

- `GET /admin/dlq/messages` — list (paginated; SQS `ReceiveMessage` with `MaxNumberOfMessages`).
- `GET /admin/dlq/messages/{messageId}` — full payload.
- `POST /admin/dlq/messages/{messageId}/replay` — re-send to main ingestion queue, delete from DLQ.
- `DELETE /admin/dlq/messages/{messageId}` — discard from DLQ.
- `POST /admin/dlq/replay-all`, `DELETE /admin/dlq/delete-all` — bulk, with a server-side count cap.

### New DLQ reader port

`core/ports/ingestion/IDlqInspector.ts` — `receive(max)`, `getById(id)`, `replay(id)`,
`discard(id)`. Adapter `infrastructure/adapters/ingestion/SqsDlqInspectorAdapter.ts`:
`ReceiveMessage` / `DeleteMessage`, and `replay` = `SendMessage` to the main queue (reuse
`SqsIngestionQueueAdapter`) then `DeleteMessage` from the DLQ. This is the **first read SQS
adapter** — keep it in the `ingestion` family.

Per-message fields surfaced: payload preview (truncated), tenant ID, S3 key, attempt count
(`ApproximateReceiveCount`), first-failure timestamp, and an error detail correlated from
CloudWatch logs by request id (best-effort link to the Lambda log stream).

> **Note on SQS semantics:** "list" via `ReceiveMessage` returns only currently-visible
> messages and starts a visibility timeout; the spec/impl must treat the list as a live sample,
> not a stable cursor. Document this in the UI ("snapshot — refresh to re-poll").

## Frontend (`Source/admin/`)

`(console)/dlq/page.tsx` using the **existing** `admin-dlq-panel` component (already has
inspect/replay/delete with loading states). Wire its `onReplay` / `onDeadLetter`/delete props to
the endpoints; add bulk replay/delete with confirmation modals.

## Open decisions

- Bulk cap (e.g. `≤ 50` per call) to bound cost/time; surface remaining count after a bulk op.
- CloudWatch correlation depth: MVP = deep-link to the log stream filtered by request id; full
  in-panel error text is a follow-up.

## Checklist

- [ ] `IDlqInspector` port + `SqsDlqInspectorAdapter` (receive/getById/replay/discard)
- [ ] 6 endpoints wired in `adminRoutes.ts`, ADMIN-gated
- [ ] replay = send-to-main + delete-from-DLQ; idempotency intact (invariant #7 — replay re-enters
      the ledger-keyed worker, duplicate delivery short-circuits)
- [ ] replay/delete (incl. bulk) audit-logged; bulk count cap enforced
- [ ] `dlq/page.tsx` wires `admin-dlq-panel`; bulk confirmation modals
- [ ] Unit tests with mocked `IDlqInspector` (replay calls send then delete; bulk bound)
- [ ] Hexagonal validator exit 0; IAM least-privilege for DLQ Receive/Delete (`validate:security`)

## Verification

- Force a message to the DLQ (parse-fail x3 in a local run); `GET /admin/dlq/messages` lists it;
  `replay` moves it back and the worker re-processes (ledger short-circuits the duplicate);
  `delete` removes it. Each mutation writes an audit row.
