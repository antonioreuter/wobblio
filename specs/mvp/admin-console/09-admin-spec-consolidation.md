# 09 — Admin-Console Spec Consolidation (single source of truth)

**Priority: P3 (three overlapping spec locations for one subsystem; two of them contradict the
shipped code and each other — this blocks confident future admin work)** ·
**Tag:** [CONTRADICTION] · **DB migration:** none · **Code change:** none (spec hygiene)

## The three locations, adjudicated against git + code

| Location | Verdict | Evidence |
|---|---|---|
| `specs/mvp/admin-console/` (00–08 + README) | **AUTHORITATIVE — this is what was built** | Created in the same commit as the implementation (`119a26ef`, "implement full admin console + Epic 15 KPI rollup"). Panels match `Source/admin/src/app/(console)/` and `admin*Routes.ts`. |
| `specs/mvp/12-admin-console/` (12a–12g) | **Superseded draft — archive** | Earlier decomposition (`46b15a10`), never implemented; later merely tidied into a subfolder (`eca3c61a`) instead of retired. Its build plan (12a foundation "blocks 12b–12f") never happened. |
| `specs/mvp/12-admin-console.md` (index) | **Stale index — rewrite** | Still says "backend has zero `/admin/*` routes", all sub-specs ⬜, links to the pre-move `./12a-*.md` paths (all dead). Reality: 12 admin route modules ship in `api-handler/`. |

## Known deviations to record in the authoritative README (already true in code)

- **Auth:** built as NextAuth against the same Cognito pool with the role read from the **DB**
  (`app_user.role`), *not* the `custom:role` JWT claim that sub-spec 00 specified — deliberate
  (project decision: no Cognito profile attributes, DB is the only role store).
- Waitlist reject maps to `INACTIVE` (no `REJECTED` enum), churn KPI omitted (no signal).
- Panels that exist **beyond** 00–08, spec'd elsewhere: `faults/` + `users/` (quota/role) from
  `specs/non-functional/02-weekly-usage-limits/` (03/07/08), `pipeline-toggles/` +
  `troubleshooting/` agentic section from `specs/non-functional/01-data-ai-pipeline/` (05, and the
  in-flight stage-health work). The README's panel table should link out to those, so the console's
  surface is enumerable from one page.

## Proposed fix

1. Move `specs/mvp/12-admin-console/` → `specs/mvp/draft/superseded-12a-12g-admin-decomposition/`
   with a one-line tombstone README ("superseded by ../admin-console/, kept for history").
2. Rewrite `specs/mvp/12-admin-console.md` as a thin pointer: epic summary, link to
   `admin-console/README.md` as the implementation truth, deviations list above.
3. Update `specs/mvp/README.md` epic-12 rows accordingly (coordinates with Fix 02).
