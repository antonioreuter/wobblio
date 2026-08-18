# specs/ — FROZEN, HISTORICAL

> **Not authoritative as of 2026-08-18.** Behavioral requirements now live in
> `openspec/specs/`. Nothing in this directory is maintained. Do not plan new
> work from these files, and do not edit them.

## Why this is frozen

These files were written as *implementation plans* — epics in build order, and
numbered fix specs. Almost all of them have been built and shipped. They record
what was intended at the time, not what the system does today, and several are
known to have diverged:

- `fixes/08-dining-out-category-misclassification/` — specified, never implemented
- Fix 10 (product links replacing comparison sets) — implemented, never specified
- Various invariant references in the epics predate later amendments

## What replaced it

| This directory held | Now lives in |
|---|---|
| What the system must do | `openspec/specs/<capability>/spec.md` |
| A planned change | `openspec/changes/<name>/` (proposal, specs delta, design, tasks) |
| A completed change | `openspec/changes/archive/` |

Capability paths mirror `Source/backend/src/core/services/`. Seeded so far:
`ingestion`, `data-intelligence`, `quota`, `admin`. The rest are written on
first touch — the change that modifies a capability authors its baseline spec.

## Still authoritative, and staying put

- `docs/wobblio_v2.4_specification_final.md` — product definition, business
  model, financial model, decision log, and design briefs. OpenSpec has no
  artifact for these, so the v2.4 document remains the **product** source of
  truth. Where it describes system *behavior*, `openspec/specs/` wins.
- `docs/runbook.md`, `docs/runbooks/`, `docs/database-setup.md` — operational
  procedure, not specification.

## Reading these files

Treat them as archaeology: useful for *why* something was built a certain way,
never as a statement of current behavior. Verify against code before relying on
anything here.
