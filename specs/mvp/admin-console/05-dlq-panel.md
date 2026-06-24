# 05 — DLQ Inspection & Replay

**Epic 10 | Phase 5 | Operator triage of failed ingestions**

## Overview

Inspect, replay, and delete messages in the ingestion dead-letter queue. The DLQ already exists in CDK
(`IngestionDlq`, fed by the main queue at `maxReceiveCount=3`), but **no non-worker Lambda has SQS read
permission on it** — this sub-spec adds that grant plus the operator endpoints.

Parent: [12 — Admin Console](../12-admin-console.md).

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (admin route module + audit log)
- [07 — Core Ingestion Pipeline](../07-core-ingestion-pipeline.md) (the DLQ + main ingestion queue)

## IAM (folded-in prerequisite)

Grant the `api-handler` Lambda least-privilege SQS permissions in CDK:
`ReceiveMessage` / `DeleteMessage` on the DLQ, and `SendMessage` on the main ingestion queue (for
replay). No wildcards. The DLQ URL + main queue URL are passed as env vars (the main queue URL env
already exists for confirm — `INGEST_QUEUE_URL`).

## Endpoints

- `GET /admin/dlq/messages` — list DLQ messages (SQS `ReceiveMessage`, `MaxNumberOfMessages`). Per
  message: truncated payload preview, tenant ID, S3 key, attempt count, first-failure timestamp, and
  error detail via CloudWatch log correlation where available.
- `GET /admin/dlq/messages/{messageId}` — full payload (modal).
- `POST /admin/dlq/messages/{messageId}/replay` — send back to the main ingestion queue, then delete
  from the DLQ. Audited (`action=dlq.replay`).
- `DELETE /admin/dlq/messages/{messageId}` — delete from DLQ permanently. Audited (`action=dlq.delete`).
- `POST /admin/dlq/replay-all` / `DELETE /admin/dlq/delete-all` — bulk variants with a count limit and
  required confirmation. Audited with the affected count.

Use an `IDeadLetterQueue` port in `core/ports/ingestion/` + an SQS adapter; the handler maps SQS errors
to domain errors and never calls the SDK directly.

## UI

List with per-row Inspect / Replay / Delete; bulk replay-all / delete-all behind confirmation modals.
CloudWatch log correlation: link each message to its Lambda log stream.

## Checklist

- [ ] CDK: least-privilege SQS grant to `api-handler` (DLQ receive/delete + main queue send); DLQ URL env var
- [ ] `IDeadLetterQueue` port + SQS adapter
- [ ] `GET /admin/dlq/messages` (paginated) + `GET /admin/dlq/messages/{id}`
- [ ] `POST .../replay`, `DELETE .../{id}`, `POST .../replay-all`, `DELETE .../delete-all` — all audited
- [ ] CloudWatch log-stream correlation link per message
- [ ] Confirmation modals on delete and all bulk actions
- [ ] `cdk synth` passes `cdk-nag`; `npm run skill:hexagonal-architecture-validator` exit 0
- [ ] Domain unit tests with mocked queue + audit ports
